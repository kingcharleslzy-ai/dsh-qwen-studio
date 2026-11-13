declare module "dsh-qwen-studio/video-host" {
  export function apply(ctx: import("@deepseek-ai/cordis").Context): void;
}
declare module "dsh-qwen-studio/film-host" {
  export function apply(ctx: import("@deepseek-ai/cordis").Context): void;
}
declare module "dsh-qwen-studio/video-client" {
  export function VideoPage(): import("react").ReactElement;
  export function installVideoPlayers(ctx: import("@deepseek-ai/cordis").Context): void;
}
