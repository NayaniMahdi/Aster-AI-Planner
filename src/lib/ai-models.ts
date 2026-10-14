export interface AiModelOption {
  id: string;
  label: string;
  tag?: string;
}

export const NVIDIA_FLAGSHIP_MODELS: AiModelOption[] = [
  { id: "meta/llama-3.2-11b-vision-instruct", label: "Meta Llama 3.2 11B Vision", tag: "Active • Ultra Fast" },
  { id: "google/diffusiongemma-26b-a4b-it", label: "Google Gemma 26B Instruct", tag: "Active • DeepMind" },
  { id: "poolside/laguna-xs-2.1", label: "Poolside Laguna XS Agent", tag: "Active • Code & Logic" },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", label: "NVIDIA Nemotron 30B Reasoning", tag: "Active • Reasoning" },
  { id: "meta/llama-3.2-90b-vision-instruct", label: "Meta Llama 3.2 90B Vision", tag: "90B Flagship" },
  { id: "deepseek-ai/deepseek-v4.1-flash", label: "DeepSeek v4.1 Flash", tag: "Reasoning Preview" },
];

export const OPENROUTER_FREE_MODELS: AiModelOption[] = [
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B Free", tag: "Flagship 70B (Free)" },
  { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1 Free", tag: "Reasoning (Free)" },
  { id: "deepseek/deepseek-chat:free", label: "DeepSeek V3 Free", tag: "671B MoE (Free)" },
  { id: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen 2.5 72B Free", tag: "72B Logic (Free)" },
  { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash Free", tag: "Ultra Fast (Free)" },
  { id: "mistralai/mistral-small-24b-instruct-2501:free", label: "Mistral 24B Free", tag: "Balanced 24B (Free)" },
];
