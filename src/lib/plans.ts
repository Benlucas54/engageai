export type PlanId = "free" | "starter" | "pro" | "enterprise";

export interface PlanLimits {
  ai_replies: number;
  follower_messages: number;
  comment_tags: number;
  voice_analyses: number;
  voice_enhancements: number;
  follower_analyses: number;
  profile_summaries: number;
  max_profiles: number;
  max_linked_accounts: number;
}

export interface PlanFeatures {
  automations: boolean;
  crm: boolean;
  follower_tools: boolean;
  voice_documents: boolean;
  custom_smart_tags: boolean;
  multi_profile: boolean;
  agent_enabled: boolean;
  priority_support: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  price: number | null; // monthly price in USD, null = custom
  stripePriceId: string | null;
  limits: PlanLimits;
  features: PlanFeatures;
}

// -1 means unlimited
const UNLIMITED = -1;

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    description: "Get started with AI-powered replies",
    price: 0,
    stripePriceId: null,
    limits: {
      ai_replies: 25,
      follower_messages: 5,
      comment_tags: 50,
      voice_analyses: 2,
      voice_enhancements: 10,
      follower_analyses: 10,
      profile_summaries: 10,
      max_profiles: 1,
      max_linked_accounts: 2,
    },
    features: {
      automations: false,
      crm: false,
      follower_tools: false,
      voice_documents: false,
      custom_smart_tags: false,
      multi_profile: false,
      agent_enabled: false,
      priority_support: false,
    },
  },
  starter: {
    id: "starter",
    name: "Starter",
    description: "For creators growing their engagement",
    price: 19,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || null,
    limits: {
      ai_replies: 200,
      follower_messages: 50,
      comment_tags: 500,
      voice_analyses: 10,
      voice_enhancements: 50,
      follower_analyses: 50,
      profile_summaries: 50,
      max_profiles: 1,
      max_linked_accounts: 4,
    },
    features: {
      automations: true,
      crm: false,
      follower_tools: true,
      voice_documents: true,
      custom_smart_tags: true,
      multi_profile: false,
      agent_enabled: true,
      priority_support: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For businesses managing multiple brands",
    price: 49,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
    limits: {
      ai_replies: 1000,
      follower_messages: 200,
      comment_tags: 2000,
      voice_analyses: 50,
      voice_enhancements: 200,
      follower_analyses: 200,
      profile_summaries: 200,
      max_profiles: 5,
      max_linked_accounts: 12,
    },
    features: {
      automations: true,
      crm: true,
      follower_tools: true,
      voice_documents: true,
      custom_smart_tags: true,
      multi_profile: true,
      agent_enabled: true,
      priority_support: false,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom limits and dedicated support",
    price: null,
    stripePriceId: null,
    limits: {
      ai_replies: UNLIMITED,
      follower_messages: UNLIMITED,
      comment_tags: UNLIMITED,
      voice_analyses: UNLIMITED,
      voice_enhancements: UNLIMITED,
      follower_analyses: UNLIMITED,
      profile_summaries: UNLIMITED,
      max_profiles: UNLIMITED,
      max_linked_accounts: UNLIMITED,
    },
    features: {
      automations: true,
      crm: true,
      follower_tools: true,
      voice_documents: true,
      custom_smart_tags: true,
      multi_profile: true,
      agent_enabled: true,
      priority_support: true,
    },
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "enterprise"];

export function getPlan(planId: PlanId): PlanDefinition {
  return PLANS[planId] || PLANS.free;
}

export function isUnlimited(value: number): boolean {
  return value === UNLIMITED;
}

export type UsageField =
  | "ai_replies"
  | "follower_messages"
  | "comment_tags"
  | "voice_analyses"
  | "voice_enhancements"
  | "follower_analyses"
  | "profile_summaries";

export const USAGE_FIELD_LABELS: Record<string, string> = {
  ai_replies: "AI Replies",
  follower_messages: "Follower Messages",
  comment_tags: "Comment Tags",
  voice_analyses: "Voice Analyses",
  voice_enhancements: "Voice Enhancements",
  follower_analyses: "Follower Analyses",
  profile_summaries: "Profile Summaries",
};
