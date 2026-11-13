import { expect, test } from "vitest";
import { bundledSkill } from "../src/skill.js";
import { apply as video } from "dsh-qwen-studio/video-host";
import { apply as film } from "dsh-qwen-studio/film-host";

test("combined video and film tools share the registered shot generator", async () => {
  const tools = new Map<string, any>();
  const owner: any = {
    inject() {},
    tools: {
      register(tool: any) { expect(tools.has(tool.name)).toBe(false); tools.set(tool.name, tool); },
      get(name: string) { return tools.get(name); },
    },
  };
  video(owner);
  film(owner);
  for (const name of ["h3_generate_video", "h3_video_status", "h3_release_gpu", "h3_film_create",
    "h3_film_next", "h3_film_review", "h3_film_finish_review", "h3_character_save", "h3_character_list"])
    expect(tools.get(name).execute).toBeTypeOf("function");
  await expect(tools.get("h3_video_status").execute({id: "not-a-job"})).rejects.toThrow("ID");
  for (const name of ["qwen-image","h3-video","h3-long-film","studio-creation","studio-model-setup"])
    expect(bundledSkill(name)).toMatchObject({name, invocation: {modelInvocable: true, userInvocable: true}});
});
