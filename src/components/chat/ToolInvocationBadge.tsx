"use client";

import { Loader2, FileEdit, FilePlus, Eye, Trash, FolderEdit } from "lucide-react";

interface StrReplaceArgs {
  command?: "view" | "create" | "str_replace" | "insert" | "undo_edit";
  path?: string;
}

interface FileManagerArgs {
  command?: "rename" | "delete";
  path?: string;
  new_path?: string;
}

type ToolArgs = StrReplaceArgs | FileManagerArgs | Record<string, unknown>;

interface ToolInvocationBadgeProps {
  toolName: string;
  args: ToolArgs;
  state: "call" | "partial-call" | "result";
}

function getFileName(path?: string) {
  if (!path) return null;
  return path.split("/").filter(Boolean).pop() ?? path;
}

function getLabel(toolName: string, args: ToolArgs): { icon: React.ReactNode; text: string } {
  if (toolName === "str_replace_editor") {
    const { command, path } = args as StrReplaceArgs;
    const file = getFileName(path);

    switch (command) {
      case "create":
        return { icon: <FilePlus className="w-3 h-3" />, text: file ? `Creating ${file}` : "Creating file" };
      case "str_replace":
      case "insert":
      case "undo_edit":
        return { icon: <FileEdit className="w-3 h-3" />, text: file ? `Editing ${file}` : "Editing file" };
      case "view":
        return { icon: <Eye className="w-3 h-3" />, text: file ? `Reading ${file}` : "Reading file" };
    }
  }

  if (toolName === "file_manager") {
    const { command, path, new_path } = args as FileManagerArgs;
    const file = getFileName(path);
    const newFile = getFileName(new_path);

    switch (command) {
      case "rename":
        return { icon: <FolderEdit className="w-3 h-3" />, text: newFile ? `Renaming to ${newFile}` : "Renaming file" };
      case "delete":
        return { icon: <Trash className="w-3 h-3" />, text: file ? `Deleting ${file}` : "Deleting file" };
    }
  }

  return { icon: <FileEdit className="w-3 h-3" />, text: toolName };
}

export function ToolInvocationBadge({ toolName, args, state }: ToolInvocationBadgeProps) {
  const { icon, text } = getLabel(toolName, args);
  const pending = state !== "result";

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pending ? undefined : "#10b981" }}>
        {pending && <Loader2 className="w-2 h-2 animate-spin text-blue-600" style={{ margin: 0 }} />}
      </div>
      <span className="text-neutral-700 flex items-center gap-1.5">
        {icon}
        {text}
      </span>
    </div>
  );
}
