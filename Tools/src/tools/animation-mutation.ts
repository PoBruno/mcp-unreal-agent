import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerAnimationTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // create_anim_blueprint
  // ---------------------------------------------------------------------------

  server.tool(
    "create_anim_blueprint",
    "Create a new Animation Blueprint asset with a target skeleton.",
    {
      name: z.string().describe("Animation Blueprint name (e.g. 'ABP_MyCharacter')"),
      packagePath: z.string().default("/Game").describe("Package path (e.g. '/Game/Animations')"),
      skeleton: z.string().describe("Skeleton asset name or path. Use '__create_test_skeleton__' for testing."),
      parentClass: z.string().optional().describe("Parent class (default: AnimInstance)"),
    },
    async ({ name, packagePath, skeleton, parentClass }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { name, packagePath, skeleton };
      if (parentClass) body.parentClass = parentClass;

      try {
        const data = await uePost("/api/create-anim-blueprint", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use add_state_machine to add state machines to the AnimGraph",
            "use add_anim_state to add states to a state machine",
            "use add_anim_transition to connect states with transitions",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // add_anim_state
  // ---------------------------------------------------------------------------

  server.tool(
    "add_anim_state",
    "Add a state to a state machine graph in an Animation Blueprint.",
    {
      blueprint: z.string().describe("Animation Blueprint name or path"),
      graph: z.string().describe("State machine graph name"),
      stateName: z.string().describe("Name for the new state"),
      animationAsset: z.string().optional().describe("Animation sequence asset to assign to the state"),
      posX: z.number().optional().describe("X position in graph"),
      posY: z.number().optional().describe("Y position in graph"),
    },
    async ({ blueprint, graph, stateName, animationAsset, posX, posY }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint, graph, stateName };
      if (animationAsset) body.animationAsset = animationAsset;
      if (posX !== undefined) body.posX = posX;
      if (posY !== undefined) body.posY = posY;

      try {
        const data = await uePost("/api/add-anim-state", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use add_anim_transition to connect this state to other states",
            "use set_state_animation to assign an animation to this state",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // remove_anim_state
  // ---------------------------------------------------------------------------

  server.tool(
    "remove_anim_state",
    "Remove a state and its connected transitions from a state machine graph.",
    {
      blueprint: z.string().describe("Animation Blueprint name or path"),
      graph: z.string().describe("State machine graph name"),
      stateName: z.string().describe("Name of the state to remove"),
    },
    async ({ blueprint, graph, stateName }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/remove-anim-state", { blueprint, graph, stateName });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // add_anim_transition
  // ---------------------------------------------------------------------------

  server.tool(
    "add_anim_transition",
    "Add a transition between two states in a state machine graph.",
    {
      blueprint: z.string().describe("Animation Blueprint name or path"),
      graph: z.string().describe("State machine graph name"),
      fromState: z.string().describe("Source state name"),
      toState: z.string().describe("Target state name"),
      crossfadeDuration: z.number().optional().describe("Crossfade duration in seconds (default: 0.2)"),
      priority: z.number().optional().describe("Transition priority order"),
      bBidirectional: z.boolean().optional().describe("Whether the transition is bidirectional"),
    },
    async ({ blueprint, graph, fromState, toState, crossfadeDuration, priority, bBidirectional }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint, graph, fromState, toState };
      if (crossfadeDuration !== undefined) body.crossfadeDuration = crossfadeDuration;
      if (priority !== undefined) body.priority = priority;
      if (bBidirectional !== undefined) body.bBidirectional = bBidirectional;

      try {
        const data = await uePost("/api/add-anim-transition", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["use set_transition_rule to configure crossfade and priority"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // set_transition_rule
  // ---------------------------------------------------------------------------

  server.tool(
    "set_transition_rule",
    "Update properties on an existing transition between two states.",
    {
      blueprint: z.string().describe("Animation Blueprint name or path"),
      graph: z.string().describe("State machine graph name"),
      fromState: z.string().describe("Source state name"),
      toState: z.string().describe("Target state name"),
      crossfadeDuration: z.number().optional().describe("Crossfade duration in seconds"),
      blendMode: z.number().optional().describe("Alpha blend option (0=Linear, 1=Cubic, 2=HermiteCubic, 3=Sinusoidal, 4=QuadraticInOut, 5=CubicInOut, 6=QuarticInOut, 7=QuinticInOut, 8=CircularIn, 9=CircularOut, 10=CircularInOut, 11=ExpIn, 12=ExpOut, 13=ExpInOut, 14=Custom)"),
      priorityOrder: z.number().optional().describe("Transition priority order"),
      logicType: z.number().optional().describe("Transition logic type (0=Standard, 1=Custom)"),
      bBidirectional: z.boolean().optional().describe("Whether the transition is bidirectional"),
    },
    async ({ blueprint, graph, fromState, toState, crossfadeDuration, blendMode, priorityOrder, logicType, bBidirectional }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint, graph, fromState, toState };
      if (crossfadeDuration !== undefined) body.crossfadeDuration = crossfadeDuration;
      if (blendMode !== undefined) body.blendMode = blendMode;
      if (priorityOrder !== undefined) body.priorityOrder = priorityOrder;
      if (logicType !== undefined) body.logicType = logicType;
      if (bBidirectional !== undefined) body.bBidirectional = bBidirectional;

      try {
        const data = await uePost("/api/set-transition-rule", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // add_anim_node
  // ---------------------------------------------------------------------------

  server.tool(
    "add_anim_node",
    "Add an animation node (sequence player, blend space, state machine) to an AnimGraph.",
    {
      blueprint: z.string().describe("Animation Blueprint name or path"),
      graph: z.string().optional().describe("Target graph name (default: AnimGraph)"),
      nodeType: z.enum(["SequencePlayer", "BlendSpacePlayer", "StateMachine"]).describe("Type of anim node to add"),
      animationAsset: z.string().optional().describe("Animation/blend space asset name to assign"),
      posX: z.number().optional().describe("X position in graph"),
      posY: z.number().optional().describe("Y position in graph"),
    },
    async ({ blueprint, graph, nodeType, animationAsset, posX, posY }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint, nodeType };
      if (graph) body.graph = graph;
      if (animationAsset) body.animationAsset = animationAsset;
      if (posX !== undefined) body.posX = posX;
      if (posY !== undefined) body.posY = posY;

      try {
        const data = await uePost("/api/add-anim-node", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: nodeType === "StateMachine" ? [
            "use add_anim_state to add states to the state machine sub-graph",
            "use add_anim_transition to connect states",
          ] : undefined,
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // add_state_machine
  // ---------------------------------------------------------------------------

  server.tool(
    "add_state_machine",
    "Add a new state machine to the root AnimGraph of an Animation Blueprint.",
    {
      blueprint: z.string().describe("Animation Blueprint name or path"),
      name: z.string().optional().describe("State machine name (default: NewStateMachine)"),
      posX: z.number().optional().describe("X position in graph"),
      posY: z.number().optional().describe("Y position in graph"),
    },
    async ({ blueprint, name, posX, posY }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint };
      if (name) body.name = name;
      if (posX !== undefined) body.posX = posX;
      if (posY !== undefined) body.posY = posY;

      try {
        const data = await uePost("/api/add-state-machine", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["use add_anim_state to add states to the state machine sub-graph"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // set_state_animation
  // ---------------------------------------------------------------------------

  server.tool(
    "set_state_animation",
    "Set or replace the animation sequence played by a state in a state machine.",
    {
      blueprint: z.string().describe("Animation Blueprint name or path"),
      graph: z.string().describe("State machine graph name"),
      stateName: z.string().describe("State name"),
      animationAsset: z.string().describe("Animation sequence asset name or path"),
    },
    async ({ blueprint, graph, stateName, animationAsset }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/set-state-animation", { blueprint, graph, stateName, animationAsset });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // create_blend_space
  // ---------------------------------------------------------------------------

  server.tool(
    "create_blend_space",
    "Create a new 2D Blend Space asset with a target skeleton.",
    {
      name: z.string().describe("Blend Space name (e.g. 'BS_Locomotion')"),
      packagePath: z.string().default("/Game").describe("Package path (e.g. '/Game/Animations')"),
      skeleton: z.string().describe("Skeleton asset name or path. Use '__create_test_skeleton__' for testing."),
    },
    async ({ name, packagePath, skeleton }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/create-blend-space", { name, packagePath, skeleton });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use set_blend_space_samples to add animation samples at X/Y coordinates",
            "use set_state_blend_space to wire it into an anim state",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // set_blend_space_samples
  // ---------------------------------------------------------------------------

  server.tool(
    "set_blend_space_samples",
    "Add animation samples to a 2D Blend Space at specific X/Y coordinates. Replaces all existing samples.",
    {
      blendSpace: z.string().describe("Blend Space asset name or path"),
      axisXName: z.string().optional().describe("Display name for the X axis"),
      axisXMin: z.number().optional().describe("Minimum value for X axis"),
      axisXMax: z.number().optional().describe("Maximum value for X axis"),
      axisYName: z.string().optional().describe("Display name for the Y axis"),
      axisYMin: z.number().optional().describe("Minimum value for Y axis"),
      axisYMax: z.number().optional().describe("Maximum value for Y axis"),
      samples: z.array(z.object({
        animationAsset: z.string().describe("Animation sequence asset name or path"),
        x: z.number().describe("X coordinate in blend space"),
        y: z.number().describe("Y coordinate in blend space"),
      })).describe("Array of animation samples with X/Y positions"),
    },
    async ({ blendSpace, axisXName, axisXMin, axisXMax, axisYName, axisYMin, axisYMax, samples }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blendSpace, samples };
      if (axisXName !== undefined) body.axisXName = axisXName;
      if (axisXMin !== undefined) body.axisXMin = axisXMin;
      if (axisXMax !== undefined) body.axisXMax = axisXMax;
      if (axisYName !== undefined) body.axisYName = axisYName;
      if (axisYMin !== undefined) body.axisYMin = axisYMin;
      if (axisYMax !== undefined) body.axisYMax = axisYMax;

      try {
        const data = await uePost("/api/set-blend-space-samples", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // set_state_blend_space
  // ---------------------------------------------------------------------------

  server.tool(
    "set_state_blend_space",
    "Place a BlendSpacePlayer node inside an anim state, connect it to the Output Animation Pose, and optionally wire X/Y input pins to named variables.",
    {
      blueprint: z.string().describe("Animation Blueprint name or path"),
      graph: z.string().describe("State machine graph name"),
      stateName: z.string().describe("State name"),
      blendSpace: z.string().describe("Blend Space asset name or path"),
      xVariable: z.string().optional().describe("Blueprint float variable name to wire to X input"),
      yVariable: z.string().optional().describe("Blueprint float variable name to wire to Y input"),
    },
    async ({ blueprint, graph, stateName, blendSpace, xVariable, yVariable }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint, graph, stateName, blendSpace };
      if (xVariable) body.xVariable = xVariable;
      if (yVariable) body.yVariable = yVariable;

      try {
        const data = await uePost("/api/set-state-blend-space", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // list_anim_slots
  // ---------------------------------------------------------------------------

  server.tool(
    "list_anim_slots",
    "List all montage slot names used in an Animation Blueprint.",
    {
      blueprint: z.string().describe("Animation Blueprint name or path"),
    },
    async ({ blueprint }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/list-anim-slots", { blueprint });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // list_sync_groups
  // ---------------------------------------------------------------------------

  server.tool(
    "list_sync_groups",
    "List all sync group names used in an Animation Blueprint.",
    {
      blueprint: z.string().describe("Animation Blueprint name or path"),
    },
    async ({ blueprint }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/list-sync-groups", { blueprint });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
