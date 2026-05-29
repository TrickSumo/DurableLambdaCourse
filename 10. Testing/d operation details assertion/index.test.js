import {
  LocalDurableTestRunner,
  OperationStatus
} from "@aws/durable-execution-sdk-js-testing";
import { ExecutionStatus, OperationType } from "@aws-sdk/client-lambda";

import { handler } from "./index.js";

let runner;

beforeAll(async () => {
  await LocalDurableTestRunner.setupTestEnvironment({ skipTime: true });
});

afterAll(async () => {
  await LocalDurableTestRunner.teardownTestEnvironment();
});

beforeEach(() => {
  runner = new LocalDurableTestRunner({ handlerFunction: handler });
});

it("returns the expected result", async () => {
  const result = await runner.run({ payload: { data: "step1 result" } });

  expect(result.getStatus()).toBe(ExecutionStatus.SUCCEEDED);
  expect(result.getResult()).toBe("step1 result");

  const step = runner.getOperation("step1");
  expect(step.getType()).toBe(OperationType.STEP);
  expect(step.getStatus()).toBe(OperationStatus.SUCCEEDED);
  expect(step.getStepDetails()?.result).toBe("step1 result");

  const wait = runner.getOperation("wait1");
  expect(wait.getType()).toBe(OperationType.WAIT);
  expect(wait.getStatus()).toBe(OperationStatus.SUCCEEDED);
  expect(wait.getWaitDetails()?.waitSeconds).toBe(10);
});