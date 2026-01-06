import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { toast } from "sonner";

interface Props {
  lastTransactionId: string | null;
  onClearTelemetry: () => void;
  onRunScenario: (id: string) => void;
}

export function CommandPalette({ lastTransactionId, onClearTelemetry, onRunScenario }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function run(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => run(() => navigate({ to: "/" }))}>MCP Console</CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/rpl" }))}>RPL Dashboard</CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/scenarios" }))}>Scenarios</CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/observability" }))}>Observability (CloudWatch / X-Ray)</CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/well-architected" }))}>Well-Architected Review</CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/architecture" }))}>AWS Architecture</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Run scenario">
          <CommandItem onSelect={() => run(() => onRunScenario("poisoning"))}>Reputation poisoning attack</CommandItem>
          <CommandItem onSelect={() => run(() => onRunScenario("goal-shift"))}>Goal change re-routes traffic</CommandItem>
          <CommandItem onSelect={() => run(() => onRunScenario("noisy-neighbor"))}>Noisy-neighbor quarantine</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() =>
              run(() => {
                if (!lastTransactionId) {
                  toast.error("No transaction yet");
                  return;
                }
                navigator.clipboard.writeText(lastTransactionId);
                toast.success("Transaction ID copied");
              })
            }
          >
            Copy last transaction id
            <CommandShortcut>⌘⇧C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => { onClearTelemetry(); toast.success("Telemetry cleared"); })}>
            Clear telemetry buffer
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
