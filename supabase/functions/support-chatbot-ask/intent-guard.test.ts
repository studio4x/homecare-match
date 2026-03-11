import {
  buildClarificationAnswer,
  isCompetitorIntent,
  isLikelyConfirmationLoopAnswer,
  isShortFollowupMessage,
  resolveConversationSignals,
  resolveDecisionPath,
  shouldForceConcreteFollowup,
} from "./intent-guard";

describe("intent guard", () => {
  it("detects short follow-up messages", () => {
    expect(isShortFollowupMessage("sim")).toBe(true);
    expect(isShortFollowupMessage("explique")).toBe(true);
    expect(isShortFollowupMessage("quero me cadastrar")).toBe(false);
  });

  it("detects competitor intent", () => {
    expect(isCompetitorIntent("QUAL O SEU CONCORRENTE?")).toBe(true);
    expect(isCompetitorIntent("quais sao os planos")).toBe(false);
  });

  it("resolves follow-up topic using assistant context", () => {
    const signals = resolveConversationSignals({
      currentMessage: "explique",
      historyMessages: [
        {
          role: "assistant",
          content:
            "Para empresas de home care o uso e gratuito e voce pode usar concierge para triagem urgente.",
        },
        {
          role: "user",
          content: "tenho uma empresa de home care",
        },
        { role: "assistant", content: "Quer saber mais sobre isso?" },
        { role: "user", content: "explique" },
      ],
    });

    expect(signals.shortFollowup).toBe(true);
    expect(signals.effectiveIntent).toBe("company_context");
    expect(signals.hasResolvedFollowupTopic).toBe(true);
  });

  it("flags loop-like confirmation answers", () => {
    expect(isLikelyConfirmationLoopAnswer("Quer saber mais sobre os detalhes?")).toBe(true);
    expect(isLikelyConfirmationLoopAnswer("O plano anual custa R$ 199 e inclui prioridade no suporte.")).toBe(false);
  });

  it("forces concrete follow-up for company/plan/trial contexts", () => {
    expect(shouldForceConcreteFollowup(true, "company_context")).toBe(true);
    expect(shouldForceConcreteFollowup(true, "plans")).toBe(true);
    expect(shouldForceConcreteFollowup(true, "trial_policy")).toBe(true);
    expect(shouldForceConcreteFollowup(true, "signup")).toBe(false);
  });

  it("builds clarification message", () => {
    expect(buildClarificationAnswer("Mariana")).toContain("Mariana");
  });

  it("resolves decision path to clarify", () => {
    const path = resolveDecisionPath({
      strictMode: true,
      chatbotUseAi: true,
      aiFirstEnabled: true,
      topScore: 0.1,
      topPublicScore: 0.1,
      hasResolvedFollowupTopic: false,
      shortFollowup: true,
      effectiveIntent: "unknown",
      highConfidence: 0.7,
      mediumConfidence: 0.45,
    });
    expect(path).toBe("clarify");
  });

  it("resolves decision path to ai in ai-first when relevance exists", () => {
    const path = resolveDecisionPath({
      strictMode: true,
      chatbotUseAi: true,
      aiFirstEnabled: true,
      topScore: 0.7,
      topPublicScore: 0.3,
      hasResolvedFollowupTopic: false,
      shortFollowup: false,
      effectiveIntent: "unknown",
      highConfidence: 0.7,
      mediumConfidence: 0.45,
    });
    expect(path).toBe("ai");
  });

  it("resolves decision path to fallback in strict ai-first with low relevance", () => {
    const path = resolveDecisionPath({
      strictMode: true,
      chatbotUseAi: true,
      aiFirstEnabled: true,
      topScore: 0.2,
      topPublicScore: 0.2,
      hasResolvedFollowupTopic: false,
      shortFollowup: false,
      effectiveIntent: "unknown",
      highConfidence: 0.7,
      mediumConfidence: 0.45,
    });
    expect(path).toBe("fallback");
  });

  it("resolves decision path to faq in faq-priority mode with high public score", () => {
    const path = resolveDecisionPath({
      strictMode: true,
      chatbotUseAi: true,
      aiFirstEnabled: false,
      topScore: 0.8,
      topPublicScore: 0.8,
      hasResolvedFollowupTopic: false,
      shortFollowup: false,
      effectiveIntent: "unknown",
      highConfidence: 0.7,
      mediumConfidence: 0.45,
    });
    expect(path).toBe("faq");
  });
});
