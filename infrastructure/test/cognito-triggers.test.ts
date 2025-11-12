const preSignup = require("../src/lambda/cognito-triggers/pre-signup");
const postConfirmation = require("../src/lambda/cognito-triggers/post-confirmation");
const preToken = require("../src/lambda/cognito-triggers/pre-token-generation");

test("pre-signup auto-confirms email", async () => {
  const event: any = { request: { userAttributes: {} }, response: {} };
  const result = await preSignup.handler(event);
  expect(result.response).toBeDefined();
  expect(result.response.autoConfirmUser).toBe(true);
});

test("post-confirmation returns early if USERS_TABLE not set", async () => {
  const event: any = {
    request: { userAttributes: { email: "foo@example.com" } },
    userName: "user-123",
  };
  // Ensure env var not set
  delete process.env.USERS_TABLE;
  const result = await postConfirmation.handler(event);
  expect(result).toBeDefined();
});

test("pre-token-generation returns event when no USERS_TABLE configured", async () => {
  const event: any = {
    request: { userAttributes: { email: "foo@example.com" } },
    response: {},
  };
  delete process.env.USERS_TABLE;
  const result = await preToken.handler(event);
  expect(result).toBeDefined();
});
