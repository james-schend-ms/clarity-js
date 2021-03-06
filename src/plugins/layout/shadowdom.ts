import { assert, isNumber, traverseNodeTree } from "../../utils";
import { getNodeIndex, IgnoreTag, NodeIndex } from "./stateprovider";

// Class names for child list mutation classifications
const FinalClassName = "cl-final";
const NewNodeClassName = "cl-new";
const TopNewNodeClassName = "cl-new-top";
const MovedNodeClassName = "cl-moved";
const UpdatedNodeClassName = "cl-updated";

export class ShadowDom {
  public doc = document.implementation.createHTMLDocument("ShadowDom");

  private nextIndex = 0;
  private removedNodes = this.doc.createElement("div");
  private shadowDomRoot = this.doc.createElement("div");
  private shadowDocument: IShadowDomNode = null;
  private classifyNodes = false;

  constructor() {
    this.doc.documentElement.appendChild(this.shadowDomRoot);
  }

  public getShadowNode(index: number): IShadowDomNode {
    let node = isNumber(index) ? this.doc.getElementById("" + index) : null;
    return node as IShadowDomNode;
  }

  public insertShadowNode(node: Node, parentIndex: number, nextSiblingIndex: number, layout?: ILayoutState): IShadowDomNode {
    let isDocument = (node === document);
    let index = this.setNodeIndex(node);
    let parent = (isDocument ? this.shadowDomRoot : this.getShadowNode(parentIndex)) as IShadowDomNode;
    let nextSibling = this.getShadowNode(nextSiblingIndex);
    let shadowNode = this.doc.createElement("div") as IShadowDomNode;
    let ignore = (node === document) ? false : parent && parent.ignore;
    shadowNode.id = "" + index;
    shadowNode.node = node;
    shadowNode.layout = layout;
    shadowNode.ignore = (layout && layout.tag === IgnoreTag) || ignore;

    if (isDocument) {
      this.shadowDocument = shadowNode;
    }

    assert(!!parent, "insertShadowNode", "parent is missing");
    if (!parent) {
      return;
    }

    if (this.classifyNodes) {
      this.setClass(shadowNode, NewNodeClassName);
      if (!this.hasClass(parent, NewNodeClassName)) {
        this.setClass(shadowNode, TopNewNodeClassName);
      }
    }

    if (nextSibling) {
      parent.insertBefore(shadowNode, nextSibling);
    } else {
      parent.appendChild(shadowNode);
    }
    return shadowNode;
  }

  public moveShadowNode(index: number, newParentIndex: number, newNextSiblingIndex: number): IShadowDomNode {
    let shadowNode = this.getShadowNode(index);
    let parent = this.getShadowNode(newParentIndex);
    let nextSibling = this.getShadowNode(newNextSiblingIndex);

    assert(!!parent, "moveShadowNode", "parent is missing");
    assert(!!shadowNode, "moveShadowNode", "shadowNode is missing");
    if (!(parent && shadowNode)) {
      return;
    }

    if (this.classifyNodes) {
      this.setClass(shadowNode, MovedNodeClassName);
      if (this.hasClass(parent as IShadowDomNode, NewNodeClassName)) {
        this.removeClass(shadowNode, TopNewNodeClassName);
      } else {
        this.setClass(shadowNode, TopNewNodeClassName);
      }
    }

    if (nextSibling) {
      parent.insertBefore(shadowNode, nextSibling);
    } else {
      parent.appendChild(shadowNode);
    }
    return shadowNode;
  }

  public updateShadowNode(index: number, newLayout?: ILayoutState) {
    let shadowNode = this.getShadowNode(index);

    assert(!!shadowNode, "updateShadowNode", "shadowNode is missing");
    if (!shadowNode) {
      return;
    }

    if (shadowNode) {
      if (newLayout) {
        shadowNode.layout = newLayout;
        shadowNode.ignore = (newLayout.tag === IgnoreTag);
      }

      if (this.classifyNodes) {
        this.setClass(shadowNode, UpdatedNodeClassName);
      }
    }
  }

  public removeShadowNode(index: number) {
    let shadowNode = this.getShadowNode(index);

    assert(!!shadowNode, "removeShadowNode", "shadowNode is missing");
    if (!shadowNode) {
      return;
    }

    this.removedNodes.appendChild(shadowNode);
  }

  public applyMutationBatch(mutations: MutationRecord[]): IShadowDomMutationSummary {
    this.doc.documentElement.appendChild(this.removedNodes);
    this.classifyNodes = true;

    let length = mutations.length;
    for (let i = 0; i < length; i++) {
      let mutation = mutations[i];
      let target = mutation.target;
      switch (mutation.type) {
        case "attributes":
        case "characterData":
          this.applyUpdate(target, mutation.attributeName, mutation.oldValue);
          break;
        case "childList":

          // Process inserts
          // We use insertBefore to insert nodes into the shadowDom, so the right sibling needs to be inserted
          // before the left sibling. For that reason we process elements from last to first (right to left)
          let addedLength = mutation.addedNodes.length;
          for (let j = addedLength - 1; j >= 0; j--) {
            let previous = mutation.previousSibling;
            let next = mutation.nextSibling;
            if (j > 0) {
              previous = mutation.addedNodes[j - 1];
            }
            if (j < addedLength - 1) {
              next = mutation.addedNodes[j + 1];
            }
            this.applyInsert(mutation.addedNodes[j], target, previous, next, false);
          }

          // Process removes
          let removedLength = mutation.removedNodes.length;
          for (let j = 0; j < removedLength; j++) {
            this.applyRemove(mutation.removedNodes[j], target);
          }
          break;
        default:
          break;
      }
    }

    // Detach removed nodes
    this.removedNodes.parentElement.removeChild(this.removedNodes);

    // Process the new state of the ShadowDom and extract the summary
    let summary = this.getMutationSummary();

    // Clean up the state to be ready for next mutation batch processing
    let finalNodes = this.doc.getElementsByClassName(FinalClassName);
    while (finalNodes.length > 0) {
      this.removeClass(finalNodes[0] as IShadowDomNode, FinalClassName);
    }
    this.removedNodes.innerHTML = "";
    this.classifyNodes = false;

    return summary;
  }

  public mirrorsRealDom(): boolean {
    let domIndices: number[] = [];
    let shadowDomIndices: number[] = [];
    let mirrors = true;

    assert(!!this.shadowDocument, "mirrorsRealDom", "shadowDocument is missing");
    assert(this.shadowDocument.node === document, "mirrorsRealDom", "shadowDocument.node !== document");

    traverseNodeTree(document, (node: Node) => {
      domIndices.push(getNodeIndex(node));
    });

    traverseNodeTree(this.shadowDocument, (shadowNode: IShadowDomNode) => {
      shadowDomIndices.push(getNodeIndex(shadowNode.node));
    });

    if (domIndices.length === shadowDomIndices.length) {
      for (let i = 0; i < domIndices.length; i++) {
        if (domIndices[i] !== shadowDomIndices[i]) {
          mirrors = false;
        }
      }
    } else {
      mirrors = false;
    }

    return mirrors;
  }

  public hasClass(shadowNode: IShadowDomNode, className: string) {
    return shadowNode ? shadowNode.classList.contains(className) : false;
  }

  public setClass(shadowNode: IShadowDomNode, className: string) {
    if (shadowNode) {
      shadowNode.classList.add(className);
    }
  }

  public removeClass(shadowNode: IShadowDomNode, className: string) {
    if (shadowNode) {
      shadowNode.classList.remove(className);
    }
  }

  public removeAllClasses(shadowNode: IShadowDomNode) {
    if (shadowNode) {
      shadowNode.removeAttribute("class");
    }
  }

  public getMutationSummary(): IShadowDomMutationSummary {
    let summary: IShadowDomMutationSummary = {
      newNodes: [],
      movedNodes: [],
      updatedNodes: [],
      removedNodes: []
    };

    // Collect all new nodes in the top-down order
    let topNewNodes = this.doc.getElementsByClassName(NewNodeClassName);
    while (topNewNodes.length > 0) {
      let topNode = topNewNodes[0] as IShadowDomNode;
      let discoverQueue: IShadowDomNode[] = [ topNode ];
      while (discoverQueue.length > 0) {
        let next = discoverQueue.shift();
        if (this.hasClass(next, NewNodeClassName)) {
          summary.newNodes.push(next);
          this.removeClass(next, NewNodeClassName);
          // Add children right-to-left
          let children = next.childNodes;
          for (let i = children.length - 1; i >= 0; i--) {
            discoverQueue.push(children[i] as IShadowDomNode);
          }
        }
      }
    }

    let moved = this.doc.getElementsByClassName(MovedNodeClassName);
    while (moved.length > 0) {
      let next = moved[0] as IShadowDomNode;
      summary.movedNodes.push(next);
      this.removeAllClasses(next);
    }

    let updated = this.doc.getElementsByClassName(UpdatedNodeClassName);
    while (updated.length > 0) {
      let next = updated[0] as IShadowDomNode;
      summary.updatedNodes.push(next);
      this.removeAllClasses(next);
    }

    let removed = this.removedNodes.childNodes;
    for (let i = 0; i < removed.length; i++) {
      let next = removed[i] as IShadowDomNode;
      if (!this.hasClass(next, NewNodeClassName)) {
        summary.removedNodes.push(next);
      }
    }

    return summary;
  }

  private applyInsert(addedNode: Node, parent: Node, previousSibling: Node, nextSibling: Node, force: boolean) {
    let addedNodeIndex = getNodeIndex(addedNode);
    let parentIndex = getNodeIndex(parent);
    let nextSiblingIndex = getNodeIndex(nextSibling);
    let validMutation = this.shouldProcessChildListMutation(addedNode, parent) || force;
    if (validMutation) {
      let action = (addedNodeIndex === null) ? Action.Insert : Action.Move;
      if (action === Action.Insert) {
        let shadowNode = this.insertShadowNode(addedNode, parentIndex, nextSiblingIndex);
        this.setClass(shadowNode, FinalClassName);

        // Process children
        // We use insertBefore to insert nodes into the shadowDom, so the right sibling needs to be inserted
        // before the left sibling. For that reason we process children from last to first (right to left)
        let nextChild = addedNode.lastChild;
        while (nextChild) {
          this.applyInsert(nextChild, addedNode, nextChild.previousSibling, nextChild.nextSibling, true);
          nextChild = nextChild.previousSibling;
        }
      } else {
        this.moveShadowNode(addedNodeIndex, parentIndex, getNodeIndex(nextSibling));
      }
    }
  }

  private applyRemove(removedNode: Node, parent: Node) {
    let removedNodeIndex = getNodeIndex(removedNode);
    let parentIndex = getNodeIndex(parent);
    if (removedNodeIndex !== null) {
      let validMutation = this.shouldProcessChildListMutation(removedNode, parent);
      if (validMutation) {
        this.removeShadowNode(removedNodeIndex);
      }
    }
  }

  private applyUpdate(updatedNode: Node, attrName: string, oldValue: string) {
    let updatedNodeIndex = getNodeIndex(updatedNode);
    if (updatedNodeIndex != null) {
      this.updateShadowNode(updatedNodeIndex);
    }
  }

  // We want to determine whether we can skip this mutation without losing data. We can do so in 2 cases:
  //  1. This is a mutation for a node that is marked as 'Final'. These are the new nodes for which we already know final position,
  //     because we have discovered them by traversing other inserted node's subtree in the real page DOM. For such final nodes,
  //     we already recorded the insert action to the appropriate position, so all other mutations can be ignored.
  //  2. This is a mutation, which attempts to add or remove a node from the child list of the node, which is marked final. For such
  //     nodes, we have already processed their entire child list in the real page DOM and all children received an insert action.
  //     This means that any other mutations are either temporary (insert something that will end up being removed) or redundant, so
  //     we can skip them
  private shouldProcessChildListMutation(child: Node, parent: Node) {
    let childNodeIndex = getNodeIndex(child);
    let parentIndex = getNodeIndex(parent);
    let parentShadowNode = null;
    if (childNodeIndex === null) {
      parentShadowNode = this.getShadowNode(parentIndex);
    } else {
      let childShadowNode = this.getShadowNode(childNodeIndex);
      parentShadowNode = childShadowNode && childShadowNode.parentNode;
    }
    return parentShadowNode && !this.hasClass(parentShadowNode, FinalClassName);
  }

  private setNodeIndex(node: Node): number {
    let index = getNodeIndex(node);
    if (index === null) {
      index = this.nextIndex;
      this.nextIndex++;
    }
    node[NodeIndex] = index;
    return index;
  }
}
