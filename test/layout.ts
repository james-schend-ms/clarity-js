import { start, stop } from "../src/clarity";
import { config } from "../src/config";
import * as core from "../src/core";
import { IgnoreTag, NodeIndex } from "../src/plugins/layout/stateprovider";
import uncompress from "./uncompress";
import { cleanupFixture, getEventsByType, observeEvents, setupFixture, triggerSend } from "./utils";

import * as chai from "chai";

let eventName = "Layout";
let assert = chai.assert;

describe("Layout Tests", () => {

  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it("checks that dom additions are captured by clarity", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Add a node to the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let div = document.createElement("div");
    let span = document.createElement("span");
    span.innerHTML = "Clarity";
    div.appendChild(span);
    document.body.insertBefore(div, document.body.firstChild);

    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 3);
      assert.equal(events[0].state.tag, "DIV");
      assert.equal(events[0].state.action, Action.Insert);
      assert.equal(events[1].state.tag, "SPAN");
      assert.equal(events[2].state.tag, "*TXT*");

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that dom removals are captured by clarity", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Remove a node from the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let dom = document.getElementById("clarity");
    dom.parentNode.removeChild(dom);

    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 1);
      assert.equal(events[0].state.tag, "DIV");
      assert.equal(events[0].state.action, Action.Remove);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that dom moves are captured correctly by clarity", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Move an existing node in the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let dom = document.getElementById("clarity");
    let backup = document.getElementById("backup");
    backup.appendChild(dom);

    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 1);
      assert.equal(events[0].state.action, Action.Move);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that insertBefore works correctly", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Insert a node before an existing node and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let dom = document.getElementById("clarity");
    let backup = document.getElementById("backup");
    let domIndex = dom[NodeIndex];
    let firstChildIndex = dom.firstChild[NodeIndex];
    dom.insertBefore(backup, dom.firstChild);

    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 1);
      assert.equal(events[0].state.action, Action.Move);
      assert.equal(events[0].state.parent, domIndex);
      assert.equal(events[0].state.next, firstChildIndex);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that moving two known nodes to a new location such that they are siblings works correctly", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Move multiple nodes from one parent to another and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let dom = document.getElementById("clarity");
    let backup = document.getElementById("backup");
    let span = document.createElement("span");

    dom.parentElement.appendChild(span);
    span.appendChild(dom);
    span.appendChild(backup);

    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 3);

      assert.equal(events[0].state.action, Action.Insert);
      assert.equal(events[0].state.tag, "SPAN");

      assert.equal(events[1].state.action, Action.Move);
      assert.equal(events[1].state.index, dom[NodeIndex]);
      assert.equal(events[1].state.next, backup[NodeIndex]);

      assert.equal(events[2].state.action, Action.Move);
      assert.equal(events[2].state.index, backup[NodeIndex]);
      assert.equal(events[2].state.next, null);

      // Explicitly signal that we are done here
      done();
    }
  });

  //  Currently we stopped capturing CSS rule modifications, so disabling this test
  //  Keeping it in code to use it again, once CSS rule modification capturing is restored
  //
  //  it('ensures we capture css rule modifications via javascript', (done) => {
  //    let observer = new MutationObserver(callback);
  //    observer.observe(document, {"childList": true,"subtree": true});

  //    // Add a style tag and later modify styles using javascript
  //    let dom = document.getElementById("clarity");
  //    let domIndex = dom[NodeIndex];
  //    let style = document.createElement("style");
  //    style.textContent = "body {}";
  //    dom.appendChild(style);
  //    let stylesheet = style.sheet;
  //    let rules = stylesheet["cssRules"] || stylesheet["rules"];
  //    rules[0].style.background = "red";

  //    function callback() {
  //      observer.disconnect();

  //      // Following jasmine feature fast forwards the async delay in setTimeout calls
  //      waitForSend();

  //      // Uncompress recent data from mutations
  //      let events = getEventsByType(LayoutEventName);

  //      assert.equal(core.bytes.length, 2);
  //      assert.equal(events.length, 2);
  //      assert.equal(events[0].state.action, Action.Insert);
  //      assert.equal(events[0].state.parent, domIndex);
  //      assert.equal(events[1].state.content.indexOf("red") > 0, true);

  //      // Explicitly signal that we are done here
  //      done();
  //    };
  //  });

  it("checks dom changes are captured accurately when multiple siblings are moved to another parent", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Move multiple nodes from one parent to another and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let dom = document.getElementById("clarity");
    let backup = document.getElementById("backup");
    let backupIndex = backup[NodeIndex];
    let childrenCount = dom.childNodes.length;
    while (dom.childNodes.length > 0) {
      backup.appendChild(dom.childNodes[0]);
    }
    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, childrenCount);
      assert.equal(events[0].state.action, Action.Move);
      assert.equal(events[0].state.parent, backupIndex);
      assert.equal(events[4].state.parent, backupIndex);
      assert.equal(events[4].state.next, events[5].state.index);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that insertion of multiple nodes in the same mutation record is handled correctly", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });
    let stopObserving = observeEvents(eventName);

    let df = document.createDocumentFragment();
    let n1 = document.createElement("div");
    let n2 = document.createElement("span");
    let n3 = document.createElement("a");
    let backup = document.getElementById("backup");
    let backupPrevious = backup.previousSibling;

    df.appendChild(n1);
    df.appendChild(n2);
    df.appendChild(n3);
    backup.parentElement.insertBefore(df, backup);

    function callback() {
      observer.disconnect();
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 3);

      // Check DIV insert event
      assert.equal(events[0].state.action, Action.Insert);
      assert.equal(events[0].state.tag, "DIV");
      assert.equal(events[0].state.previous, backupPrevious[NodeIndex]);
      assert.equal(events[0].state.next, n2[NodeIndex]);

      // Check SPAN insert event
      assert.equal(events[1].state.action, Action.Insert);
      assert.equal(events[1].state.tag, "SPAN");
      assert.equal(events[1].state.next, n3[NodeIndex]);

      // Check A insert event
      assert.equal(events[2].state.action, Action.Insert);
      assert.equal(events[2].state.tag, "A");
      assert.equal(events[2].state.next, backup[NodeIndex]);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that removal of multiple nodes in the same mutation record is handled correctly", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });
    let stopObserving = observeEvents(eventName);

    let dom = document.getElementById("clarity");
    let children = [];
    let childIndices = [];
    for (let i = 0; i < dom.childNodes.length; i++) {
      let child = dom.childNodes[i];
      let index = child[NodeIndex];
      children.push(child);
      childIndices[index] = true;
    }

    // Remove all children
    dom.innerHTML = "";

    function callback() {
      observer.disconnect();
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      // Make sure that there is a remove event for every child
      for (let i = 0; i < events.length; i++) {
        let index = events[i].state.index;
        assert.equal(events[i].state.action, Action.Remove);
        assert.equal(childIndices[index], true);
        delete childIndices[index];
      }

      // Make sure that clarity index is cleared from all removed nodes
      for (let i = 0; i < children.length; i++) {
        assert.equal(NodeIndex in children[i], false);
      }

      // Explicitly signal that we are done here
      done();
    }
  });

  // Nodes that are inserted and then removed in the same mutation don't produce any events and their mutations are ignored
  // However, it's possible that some other observed node can be appended to the ignored node and then get removed from the
  // DOM as a part of the ignored node's subtree. This test makes sure that removing observed node this way is captured correctly.
  it("checks that removal of a known node through a subtree of its ignored parent is handled correctly", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });
    let stopObserving = observeEvents(eventName);

    let clarityNode = document.getElementById("clarity");
    let backupNode = document.getElementById("backup");
    let backupNodeIndex = backupNode[NodeIndex];
    let tempNode = document.createElement("div");

    clarityNode.appendChild(tempNode);
    tempNode.appendChild(backupNode);
    clarityNode.removeChild(tempNode);

    function callback() {
      observer.disconnect();
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 1);
      assert.equal(events[0].state.action, Action.Remove);
      assert.equal(events[0].state.index, backupNodeIndex);

      // Make sure that clarity index is cleared from all removed nodes
      assert.equal(NodeIndex in tempNode, false);
      assert.equal(NodeIndex in backupNode, false);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that dom additions with immediate attribute change are handled by clarity", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true, attributes: true });

    // Add a node to the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let count = 0;
    let div = document.createElement("div");
    div.innerHTML = "Clarity";
    document.body.appendChild(div);

    function callback(mutations) {
      div.setAttribute("data-clarity", "test");
      if (count++ > 0) {
        observer.disconnect();

        // Following jasmine feature fast forwards the async delay in setTimeout calls
        triggerSend();

        // Uncompress recent data from mutations
        let events = stopObserving();

        assert.equal(events.length, 3);
        assert.equal(events[0].state.tag, "DIV");
        assert.equal(events[0].state.action, Action.Insert);
        assert.equal(events[1].state.tag, "*TXT*");

        // Explicitly signal that we are done here
        done();
      }
    }
  });

  it("checks that nodes that are added and removed in the same mutation don't create index gaps in event logs ", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true, attributes: true });

    // Add a node to the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let div1 = document.createElement("div");
    let div2 = document.createElement("div");
    let div3 = document.createElement("div");

    document.body.appendChild(div1);
    document.body.appendChild(div3);
    document.body.appendChild(div2);
    document.body.removeChild(div3);

    function callback(mutations) {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 2);
      assert.equal(events[0].state.action, Action.Insert);
      assert.equal(events[0].state.index, div1[NodeIndex]);
      assert.equal(events[1].state.action, Action.Insert);
      assert.equal(events[1].state.index, div2[NodeIndex]);
      assert.equal(div1[NodeIndex], div2[NodeIndex] - 1);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that we do not instrument disconnected dom tree", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true, attributes: true });

    // Add a node to the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let div = document.createElement("div");
    document.body.appendChild(div);
    document.body.removeChild(div);

    function callback(mutations) {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      // Prove that we didn't send any extra instrumentation back for no-op mutation
      assert.equal(events.length, 0);

      // Make sure that clarity index is cleared from all removed nodes
      assert.equal(NodeIndex in div, false);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that we do not instrument child nodes within disconnected dom tree", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true, attributes: true });

    // Add a node to the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let div = document.createElement("div");
    let span = document.createElement("span");
    document.body.appendChild(div);
    div.appendChild(span);
    document.body.removeChild(div);

    function callback(mutations) {
      observer.disconnect();
      triggerSend();

      let events = stopObserving();

      // Prove that we didn't send any extra instrumentation back for no-op mutation
      assert.equal(events.length, 0);

      // Make sure that clarity index is cleared from all removed nodes
      assert.equal(NodeIndex in div, false);
      assert.equal(NodeIndex in span, false);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that we do not instrument child nodes within a previously observed disconnected dom tree", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true, attributes: true });

    let stopObserving = observeEvents(eventName);
    let clarityDiv = document.getElementById("clarity");
    let span = document.createElement("span");
    let clarityDivIndex = clarityDiv[NodeIndex];
    clarityDiv.appendChild(span);
    clarityDiv.parentElement.removeChild(clarityDiv);

    function callback(mutations) {
      observer.disconnect();
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      // Prove that we didn't send any extra instrumentation back for no-op mutation
      assert.equal(events.length, 1);
      assert.equal(events[0].state.action, Action.Remove);
      assert.equal(events[0].state.index, clarityDivIndex);

      // Make sure that clarity index is cleared from all removed nodes
      assert.equal(NodeIndex in clarityDiv, false);
      assert.equal(NodeIndex in span, false);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that we do not instrument inserted nodes twice", (done) => {
    // Edge case scenario for the test:
    // 1. Node n1 is added to the page
    // 2. Immediately node n2 is appended to n1
    // They both show up as insertions in the same batch of mutations
    // When we serialize n1, we will discover its children and serialize n2 as well
    // Make sure we don't serialize n2 again when we move on to n2 insertion mutation record
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Insert a node before an existing node and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let n1 = document.createElement("div");
    let n2 = document.createElement("span");
    let bodyIndex = document.body[NodeIndex];
    document.body.appendChild(n1);
    n1.appendChild(n2);

    function callback() {
      observer.disconnect();
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 2);

      // Check DIV insert event
      assert.equal(events[0].state.action, Action.Insert);
      assert.equal(events[0].state.parent, bodyIndex);
      assert.equal(events[0].state.tag, "DIV");

      // Check SPAN insert event
      assert.equal(events[1].state.action, Action.Insert);
      assert.equal(events[1].state.parent, n1[NodeIndex]);
      assert.equal(events[1].state.tag, "SPAN");

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that all kinds of mutations within the same batch have the same mutation sequence", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    let stopObserving = observeEvents(eventName);
    let divOne = document.createElement("div");
    let divTwo = document.createElement("div");
    let clarityDiv = document.getElementById("clarity");
    let backup = document.getElementById("backup");
    document.body.appendChild(divOne);  // Insert
    clarityDiv.firstElementChild.id = "updatedId"; // Update
    divOne.appendChild(clarityDiv); // Move
    backup.parentElement.removeChild(backup); // Remove

    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 4);
      assert.equal(events[0].state.action, Action.Insert);
      assert.equal(events[1].state.action, Action.Move);
      assert.equal(events[2].state.action, Action.Update);
      assert.equal(events[3].state.action, Action.Remove);

      // Make sure all events have the same mutation sequence
      let mutationSequence = events[0].state.mutationSequence;
      assert.isTrue(mutationSequence >= 0);
      assert.equal(events[0].state.mutationSequence, mutationSequence);
      assert.equal(events[1].state.mutationSequence, mutationSequence);
      assert.equal(events[2].state.mutationSequence, mutationSequence);
      assert.equal(events[3].state.mutationSequence, mutationSequence);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that mutation sequence number is incremented between mutation callbacks", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    let stopObserving = observeEvents(eventName);
    let divOne = document.createElement("div");
    let divTwo = document.createElement("div");
    let callbackNumber = 0;
    document.body.appendChild(divOne);

    function callback() {
      if (callbackNumber === 1) {
        observer.disconnect();
        triggerSend();

        // Uncompress recent data from mutations
        let events = stopObserving();
        assert.equal(events.length, 2);

        let firstEventSequence = events[0].state.mutationSequence;
        assert.isTrue(firstEventSequence >= 0);
        assert.equal(events[1].state.mutationSequence, firstEventSequence + 1);

        // Explicitly signal that we are done here
        done();
      } else {
        document.body.appendChild(divTwo);
      }
      callbackNumber++;
    }
  });

  it("checks that images source is not captured if the config disallows it", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Disable images
    config.showImages = false;

    // Add a node to the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let img = document.createElement("img");
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAEALAAAAAABAAEAAAIBTAA7";
    document.body.appendChild(img);

    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();
      assert.equal(events.length, 1);
      assert.equal(events[0].state.tag, "IMG");
      assert.equal(events[0].state.action, Action.Insert);
      assert.equal(events[0].state.attributes["src"], undefined);
      assert.equal(events[0].state.layout.width, 0);
      assert.equal(events[0].state.layout.height, 0);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that images source is captured if the config allows it", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Disable images
    config.showImages = true;

    // Add a node to the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let img = document.createElement("img");
    let src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAEALAAAAAABAAEAAAIBTAA7";
    img.src = src;
    document.body.appendChild(img);

    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 1);
      assert.equal(events[0].state.tag, "IMG");
      assert.equal(events[0].state.action, Action.Insert);
      assert.equal(events[0].state.attributes["src"], src);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that input value is masked if the config is set to not show text", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Disable images
    config.showText = false;

    // Add a node to the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let input = document.createElement("input");
    input.setAttribute("value", "Clarity");
    document.body.appendChild(input);

    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 1);
      assert.equal(events[0].state.tag, "INPUT");
      assert.equal(events[0].state.action, Action.Insert);
      assert.equal(events[0].state.attributes["value"], "*******");

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that script element and its text are ignored", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Add a node to the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let script = document.createElement("script");
    script.innerText = "/*some javascriptcode*/";
    document.body.appendChild(script);

    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 2);
      assert.equal(events[0].state.action, Action.Insert);
      assert.equal(events[0].state.tag, IgnoreTag);
      assert.equal(events[0].state.nodeType, Node.ELEMENT_NODE);

      assert.equal(events[1].state.action, Action.Insert);
      assert.equal(events[1].state.tag, IgnoreTag);
      assert.equal(events[1].state.nodeType, Node.TEXT_NODE);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that meta element is ignored", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Add a node to the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let meta = document.createElement("meta");
    document.body.appendChild(meta);

    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 1);
      assert.equal(events[0].state.action, Action.Insert);
      assert.equal(events[0].state.tag, IgnoreTag);
      assert.equal(events[0].state.nodeType, Node.ELEMENT_NODE);

      // Explicitly signal that we are done here
      done();
    }
  });

  it("checks that comment node is ignored", (done) => {
    let observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });

    // Add a node to the document and observe Clarity events
    let stopObserving = observeEvents(eventName);
    let comment = document.createComment("some explanation");
    document.body.appendChild(comment);

    function callback() {
      observer.disconnect();

      // Following jasmine feature fast forwards the async delay in setTimeout calls
      triggerSend();

      // Uncompress recent data from mutations
      let events = stopObserving();

      assert.equal(events.length, 1);
      assert.equal(events[0].state.action, Action.Insert);
      assert.equal(events[0].state.tag, IgnoreTag);
      assert.equal(events[0].state.nodeType, Node.COMMENT_NODE);

      // Explicitly signal that we are done here
      done();
    }
  });
});
