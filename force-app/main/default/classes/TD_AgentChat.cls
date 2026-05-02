/**
 * TD_AgentChat - thin proxy from LWC to the Electra Agentforce agent.
 *
 * Invokes the standard Agentforce action `generateAiAgentResponse` against the
 * configured agent (e.g. Electra_Dealer_Assistant). Stateless: caller passes
 * the current sessionId and gets back the (possibly new) one to reuse.
 */
public with sharing class TD_AgentChat {

    public class AgentReply {
        @AuraEnabled public String agentResponse;
        @AuraEnabled public String sessionId;
        @AuraEnabled public Boolean success;
        @AuraEnabled public String errorMessage;
        @AuraEnabled public Long latencyMs;
    }

    @AuraEnabled
    public static AgentReply handleMessage(String agentApiName, String sessionId, String userMessage) {
        AgentReply out = new AgentReply();
        Long t0 = DateTime.now().getTime();
        try {
            if (String.isBlank(agentApiName)) {
                out.success = false;
                out.errorMessage = 'agentApiName is required. Set it on the App Page property.';
                return out;
            }
            if (String.isBlank(userMessage)) {
                out.success = false;
                out.errorMessage = 'userMessage is required.';
                return out;
            }

            Invocable.Action action = Invocable.Action.createCustomAction(
                'generateAiAgentResponse', agentApiName
            );
            action.setInvocationParameter('userMessage', userMessage);
            if (String.isNotBlank(sessionId)) {
                action.setInvocationParameter('sessionId', sessionId);
            }

            List<Invocable.Action.Result> results = action.invoke();
            if (results == null || results.isEmpty()) {
                out.success = false;
                out.errorMessage = 'No response from agent.';
                return out;
            }
            Invocable.Action.Result first = results[0];
            if (!first.isSuccess()) {
                out.success = false;
                out.errorMessage = first.getErrors() != null && !first.getErrors().isEmpty()
                    ? first.getErrors()[0].getMessage()
                    : 'Agent returned an unsuccessful result.';
                return out;
            }

            Map<String, Object> outputs = first.getOutputParameters();
            Object resp = outputs != null ? outputs.get('agentResponse') : null;
            Object sid  = outputs != null ? outputs.get('sessionId') : null;
            String rawResp = resp != null ? String.valueOf(resp) : '';
            out.agentResponse = unwrapAgentText(rawResp);
            out.sessionId = sid != null ? String.valueOf(sid) : sessionId;
            out.success = true;
        } catch (Exception e) {
            out.success = false;
            out.errorMessage = e.getMessage();
        } finally {
            out.latencyMs = DateTime.now().getTime() - t0;
        }
        return out;
    }

    /**
     * Agentforce sometimes returns the reply as a JSON envelope like
     * {"type":"Text","value":"..."} or an array of those. Unwrap to the
     * human-readable string. Falls back to the raw value if it isn't JSON.
     */
    private static String unwrapAgentText(String raw) {
        if (String.isBlank(raw)) return raw;
        String trimmed = raw.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return raw;
        try {
            Object parsed = JSON.deserializeUntyped(trimmed);
            String extracted = extractText(parsed);
            return String.isBlank(extracted) ? raw : extracted;
        } catch (Exception e) {
            return raw;
        }
    }

    private static String extractText(Object node) {
        if (node == null) return '';
        if (node instanceof String) return (String) node;
        if (node instanceof Map<String, Object>) {
            Map<String, Object> m = (Map<String, Object>) node;
            for (String key : new List<String>{ 'value', 'text', 'message', 'content', 'output' }) {
                if (m.containsKey(key) && m.get(key) != null) {
                    String t = extractText(m.get(key));
                    if (String.isNotBlank(t)) return t;
                }
            }
            return '';
        }
        if (node instanceof List<Object>) {
            List<String> parts = new List<String>();
            for (Object item : (List<Object>) node) {
                String t = extractText(item);
                if (String.isNotBlank(t)) parts.add(t);
            }
            return String.join(parts, '\n\n');
        }
        return String.valueOf(node);
    }
}