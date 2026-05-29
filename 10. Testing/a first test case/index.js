import { withDurableExecution } from '@aws/durable-execution-sdk-js';

export const handler = withDurableExecution(async (event, context) => {
  const result = await context.step("step1", () => "step1 result");
  return result;

  // const results = await context.parallel("fetch-all", [
  //   async (ctx) => await ctx.step("fetch-a", () => "data-a"),
  //   async (ctx) => await ctx.step("fetch-b", () => "data-b"),
  //   async (ctx) => await ctx.step("fetch-c", () => "data-c"),
  // ]);
  // return results.getResults();

});
