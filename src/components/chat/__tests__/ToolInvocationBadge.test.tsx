import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationBadge } from "../ToolInvocationBadge";

afterEach(() => {
  cleanup();
});

test("shows 'Creating' label for str_replace_editor create command", () => {
  render(
    <ToolInvocationBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "/components/Button.tsx" }}
      state="result"
    />
  );
  expect(screen.getByText(/Creating Button\.tsx/)).toBeDefined();
});

test("shows 'Editing' label for str_replace_editor str_replace command", () => {
  render(
    <ToolInvocationBadge
      toolName="str_replace_editor"
      args={{ command: "str_replace", path: "/components/Card.tsx" }}
      state="result"
    />
  );
  expect(screen.getByText(/Editing Card\.tsx/)).toBeDefined();
});

test("shows 'Editing' label for str_replace_editor insert command", () => {
  render(
    <ToolInvocationBadge
      toolName="str_replace_editor"
      args={{ command: "insert", path: "/App.tsx" }}
      state="result"
    />
  );
  expect(screen.getByText(/Editing App\.tsx/)).toBeDefined();
});

test("shows 'Reading' label for str_replace_editor view command", () => {
  render(
    <ToolInvocationBadge
      toolName="str_replace_editor"
      args={{ command: "view", path: "/lib/utils.ts" }}
      state="result"
    />
  );
  expect(screen.getByText(/Reading utils\.ts/)).toBeDefined();
});

test("shows 'Renaming' label for file_manager rename command", () => {
  render(
    <ToolInvocationBadge
      toolName="file_manager"
      args={{ command: "rename", path: "/old.tsx", new_path: "/components/New.tsx" }}
      state="result"
    />
  );
  expect(screen.getByText(/Renaming to New\.tsx/)).toBeDefined();
});

test("shows 'Deleting' label for file_manager delete command", () => {
  render(
    <ToolInvocationBadge
      toolName="file_manager"
      args={{ command: "delete", path: "/components/Old.tsx" }}
      state="result"
    />
  );
  expect(screen.getByText(/Deleting Old\.tsx/)).toBeDefined();
});

test("extracts filename from nested path", () => {
  render(
    <ToolInvocationBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "/src/components/ui/Button.tsx" }}
      state="result"
    />
  );
  expect(screen.getByText(/Creating Button\.tsx/)).toBeDefined();
});

test("falls back to tool name for unknown tools", () => {
  render(
    <ToolInvocationBadge
      toolName="some_unknown_tool"
      args={{}}
      state="result"
    />
  );
  expect(screen.getByText("some_unknown_tool")).toBeDefined();
});

test("shows fallback label when path is missing", () => {
  render(
    <ToolInvocationBadge
      toolName="str_replace_editor"
      args={{ command: "create" }}
      state="result"
    />
  );
  expect(screen.getByText(/Creating file/)).toBeDefined();
});

test("renders spinner when state is not result", () => {
  const { container } = render(
    <ToolInvocationBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.tsx" }}
      state="call"
    />
  );
  expect(container.querySelector(".animate-spin")).toBeDefined();
});

test("does not render spinner when state is result", () => {
  const { container } = render(
    <ToolInvocationBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.tsx" }}
      state="result"
    />
  );
  expect(container.querySelector(".animate-spin")).toBeNull();
});
