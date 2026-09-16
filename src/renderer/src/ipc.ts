import { applyRpcEvent } from "@/chat/state";
import { useChat } from "@/chat/store";
import { useSession } from "@/session/store";
import type { RpcEvent } from "@shared/protocol";

let bound = false;
let pendingUpdate: RpcEvent | null = null;
let raf = 0;

function apply(event: RpcEvent): void {
  useChat.setState((state) => applyRpcEvent(state, event));
}

export function bindIpc(): void {
  if (bound) return;
  bound = true;

  window.pi.onEvent((event) => {
    if (event.type === "message_update") {
      pendingUpdate = event;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          const queued = pendingUpdate;
          pendingUpdate = null;
          if (queued) apply(queued);
        });
      }
      return;
    }
    if (pendingUpdate) {
      const queued = pendingUpdate;
      pendingUpdate = null;
      apply(queued);
    }
    apply(event);
  });

  window.pi.onStatus((status, error) => {
    useSession.setState({ connection: status, error: error ?? null });
  });
}
