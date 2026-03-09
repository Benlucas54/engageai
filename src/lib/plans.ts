export type PlanId = "free" | "basic" | "pro" | "enterprise";

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
  price: number | null; // monthly price in GBP, null = custom
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
    description: "Full access to scraping, CRM, and inbox — no AI",
    price: 0,
    stripePriceId: null,
    limits: {
      ai_replies: 0,
      follower_messages: 0,
      comment_tags: 0,
      voice_analyses: 0,
      voice_enhancements: 0,
      follower_analyses: 0,
      profile_summaries: 0,
      max_profiles: 1,
      max_linked_accounts: 2,
    },
    features: {
      automations: false,
      crm: true,
      follower_tools: false,
      voice_documents: false,
      custom_smart_tags: false,
      multi_profile: false,
      agent_enabled: false,
      priority_support: false,
    },
  },
  basic: {
    id: "basic",
    name: "Basic",
    description: "AI-powered replies and follower tools",
    price: 8.99,
    stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || null,
    limits: {
      ai_replies: 100,
      follower_messages: 20,
      comment_tags: 200,
      voice_analyses: 5,
      voice_enhancements: 20,
      follower_analyses: 0,
      profile_summaries: 0,
      max_profiles: 1,
      max_linked_accounts: 3,
    },
    features: {
      automations: false,
      crm: true,
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
    price: 19.99,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
    limits: {
      ai_replies: 500,
      follower_messages: 100,
      comment_tags: 1000,
      voice_analyses: 25,
      voice_enhancements: 100,
      follower_analyses: 100,
      profile_summaries: 100,
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
    description: "Unlimited everything with priority support",
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

export const PLAN_ORDER: PlanId[] = ["free", "basic", "pro", "enterprise"];

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
