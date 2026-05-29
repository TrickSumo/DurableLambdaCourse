import { CloudDurableTestRunner } from "@aws/durable-execution-sdk-js-testing";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { ExecutionStatus } from "@aws-sdk/client-lambda";

const runner = new CloudDurableTestRunner({
  functionName: "durable1:$LATEST",
  client: new LambdaClient({ region: "us-east-1" }),
});

it("runs against a deployed function", async () => {
  const result = await runner.run({ payload: { data: "step1 result" } });

  expect(result.getStatus()).toBe(ExecutionStatus.SUCCEEDED);
  expect(result.getResult()).toBe("step1 result");
});