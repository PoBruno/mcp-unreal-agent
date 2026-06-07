import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerWidgetTools(server: McpServer): void {
  // ---------------------------------------------------------------
  // list_widget_tree
  // ---------------------------------------------------------------
  server.tool(
    "list_widget_tree",
    "List the full widget hierarchy of a Widget Blueprint (UMG). Shows widget names, classes, parents, slots, and panel/child relationships. Only works on Widget Blueprints.",
    {
      blueprint: z.string().describe("Widget Blueprint name or package path (e.g. 'WBP_PlayerHud')"),
    },
    async ({ blueprint }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/list-widget-tree", { blueprint });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------
  // get_widget_properties
  // ---------------------------------------------------------------
  server.tool(
    "get_widget_properties",
    "Get all editable properties of a specific widget in a Widget Blueprint, including slot properties (anchors, alignment, padding, etc.). Use this to inspect current values before calling set_widget_property.",
    {
      blueprint: z.string().describe("Widget Blueprint name or package path"),
      widget: z.string().describe("Name of the widget to inspect"),
    },
    async ({ blueprint, widget }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/get-widget-properties", { blueprint, widget });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------
  // add_widget
  // ---------------------------------------------------------------
  server.tool(
    "add_widget",
    "Add a widget to a Widget Blueprint's designer hierarchy. Common widget classes: TextBlock, Button, Image, VerticalBox, HorizontalBox, Overlay, CanvasPanel, Border, SizeBox, ScaleBox, ScrollBox, Spacer, ProgressBar, Slider, CheckBox. If no parent is specified, adds to the root panel.",
    {
      blueprint: z.string().describe("Widget Blueprint name or package path"),
      widgetClass: z.string().describe("Widget class name (e.g. 'TextBlock', 'Button', 'VerticalBox')"),
      name: z.string().describe("Name for the new widget (e.g. 'TitleText', 'StartButton')"),
      parent: z.string().optional().describe("Name of the parent panel widget (optional, defaults to root panel)"),
    },
    async ({ blueprint, widgetClass, name, parent }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint, widgetClass, name };
      if (parent) body.parent = parent;

      try {
        const data = await uePost("/api/add-widget", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            `list_widget_tree(blueprint="${blueprint}") — verify the widget hierarchy`,
            `set_widget_property(blueprint="${blueprint}", widget="${name}", ...) — configure widget properties`,
            `get_widget_properties(blueprint="${blueprint}", widget="${name}") — see all available properties`,
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------
  // remove_widget
  // ---------------------------------------------------------------
  server.tool(
    "remove_widget",
    "Remove a widget from a Widget Blueprint's designer hierarchy. Cannot remove panel widgets that have children — remove or move the children first.",
    {
      blueprint: z.string().describe("Widget Blueprint name or package path"),
      widget: z.string().describe("Name of the widget to remove"),
    },
    async ({ blueprint, widget }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/remove-widget", { blueprint, widget });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            `list_widget_tree(blueprint="${blueprint}") — verify the widget was removed`,
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------
  // set_widget_property
  // ---------------------------------------------------------------
  server.tool(
    "set_widget_property",
    "Set a property on a widget or its slot (layout) in a Widget Blueprint. Properties are searched on the widget first, then on its slot. For FText properties, bare strings are automatically wrapped in INVTEXT(). Use get_widget_properties to discover available properties.",
    {
      blueprint: z.string().describe("Widget Blueprint name or package path"),
      widget: z.string().describe("Name of the widget to modify"),
      property: z.string().describe("Property name (e.g. 'Text', 'ColorAndOpacity', 'Visibility')"),
      value: z.string().describe("Value to set (e.g. 'Hello World' for Text, '(R=1,G=0,B=0,A=1)' for color)"),
    },
    async ({ blueprint, widget, property, value }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/set-widget-property", { blueprint, widget, property, value });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            `get_widget_properties(blueprint="${blueprint}", widget="${widget}") — verify the change`,
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------
  // move_widget
  // ---------------------------------------------------------------
  server.tool(
    "move_widget",
    "Move a widget from its current parent to a different panel widget in the same Widget Blueprint. Includes cycle detection to prevent moving a widget into its own descendant.",
    {
      blueprint: z.string().describe("Widget Blueprint name or package path"),
      widget: z.string().describe("Name of the widget to move"),
      newParent: z.string().describe("Name of the new parent panel widget"),
    },
    async ({ blueprint, widget, newParent }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/move-widget", { blueprint, widget, newParent });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            `list_widget_tree(blueprint="${blueprint}") — verify the new hierarchy`,
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------
  // create_widget_blueprint
  // ---------------------------------------------------------------
  server.tool(
    "create_widget_blueprint",
    "Create a new empty Widget Blueprint (UMG). The new blueprint will have an empty widget tree ready for adding widgets.",
    {
      name: z.string().describe("Name for the new Widget Blueprint (e.g. 'WBP_MainMenu')"),
      packagePath: z.string().optional().describe("Package path (default: '/Game')"),
    },
    async ({ name, packagePath }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { name };
      if (packagePath) body.packagePath = packagePath;

      try {
        const data = await uePost("/api/create-widget-blueprint", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            `add_widget(blueprint="${name}", widgetClass="CanvasPanel", name="RootCanvas") — add a root panel`,
            `list_widget_tree(blueprint="${name}") — view the widget hierarchy`,
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
