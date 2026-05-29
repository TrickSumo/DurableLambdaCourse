import { withDurableExecution } from '@aws/durable-execution-sdk-js';

export const handler = withDurableExecution(async (event, context) => {
  await context.wait({ seconds: 10 });

  const result = await context.step("step1", () => event.data);

  return await context.waitForCallback("approval", async (callbackId) => {
    // In production this would notify an external system
  });

});
