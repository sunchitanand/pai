import { MonitorIcon, MousePointerClickIcon, FileTextIcon, CameraIcon, AlertCircleIcon, CheckIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type BrowseToolName = "browse_navigate" | "browse_snapshot" | "browse_action" | "browse_text" | "browse_screenshot";

interface ToolBrowseActionProps {
  state: string;
  toolName: BrowseToolName;
  input?: unknown;
  output?: unknown;
}

const toolConfig: Record<BrowseToolName, { icon: typeof MonitorIcon; loadingText: string; successText: string }> = {
  browse_navigate: { icon: MonitorIcon, loadingText: "Navigating to page...", successText: "Navigated" },
  browse_snapshot: { icon: MousePointerClickIcon, loadingText: "Getting interactive elements...", successText: "Snapshot captured" },
  browse_action: { icon: MousePointerClickIcon, loadingText: "Performing action...", successText: "Action completed" },
  browse_text: { icon: FileTextIcon, loadingText: "Extracting page text...", successText: "Text extracted" },
  browse_screenshot: { icon: CameraIcon, loadingText: "Taking screenshot...", successText: "Screenshot saved" },
};

export function ToolBrowseAction({ state, toolName, input, output }: ToolBrowseActionProps) {
  const config = toolConfig[toolName];
  const Icon = config.icon;
  const inputObj = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const outputObj = (output && typeof output === "object" ? output : {}) as Record<string, unknown>;

  if (state === "input-available") {
    let detail = "";
    if (toolName === "browse_navigate" && inputObj.url) {
      detail = `: ${String(inputObj.url).slice(0, 60)}`;
    } else if (toolName === "browse_action" && inputObj.kind) {
      detail = `: ${inputObj.kind}${inputObj.ref ? ` on ${inputObj.ref}` : ""}`;
    }

    return (
      <Card className="my-2 gap-0 rounded-lg border-border/50 py-0 shadow-none">
        <CardContent className="flex items-center gap-2 px-3 py-2.5">
          <Icon className="size-3.5 shrink-0 animate-pulse text-primary" />
          <span className="text-xs text-muted-foreground">
            {config.loadingText}{detail}
          </span>
        </CardContent>
      </Card>
    );
  }

  if (state === "output-error" || (outputObj.ok === false)) {
    return (
      <Card className="my-2 gap-0 rounded-lg border-destructive/50 py-0 shadow-none">
        <CardContent className="flex items-center gap-2 px-3 py-2.5">
          <AlertCircleIcon className="size-3.5 shrink-0 text-destructive" />
          <span className="text-xs text-destructive">
            {outputObj.error ? String(outputObj.error).slice(0, 120) : `${config.successText} failed.`}
          </span>
        </CardContent>
      </Card>
    );
  }

  if (state === "output-available") {
    let detail = "";
    if (toolName === "browse_navigate" && outputObj.title) {
      detail = `: ${String(outputObj.title).slice(0, 60)}`;
    } else if (toolName === "browse_screenshot" && outputObj.downloadUrl) {
      detail = " — saved as artifact";
    }

    const screenshotUrl = toolName === "browse_screenshot" && outputObj.downloadUrl
      ? String(outputObj.downloadUrl)
      : null;

    return (
      <Card className="my-2 gap-0 rounded-lg border-green-500/10 py-0 shadow-none">
        <CardContent className="flex flex-col gap-2 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <CheckIcon className="size-3.5 shrink-0 text-green-500" />
            <span className="text-xs text-foreground">
              {config.successText}{detail}
            </span>
          </div>
          {screenshotUrl && (
            <a href={screenshotUrl} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={screenshotUrl}
                alt="Browser screenshot"
                className="max-h-80 w-auto rounded border border-border/50 object-contain"
              />
            </a>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
