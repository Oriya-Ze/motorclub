import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMessagesPanelOptional } from "@/components/MessagesPanel";

/** Redirect legacy /messages routes to open the side panel instead */
export default function MessagesRedirect() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const panel = useMessagesPanelOptional();

  useEffect(() => {
    panel?.openMessages(conversationId);
    navigate("/", { replace: true });
  }, [conversationId, navigate, panel]);

  return null;
}
