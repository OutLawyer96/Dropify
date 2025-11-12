export const handler = async (event: any) => {
  // Auto-confirm users who sign up via email
  try {
    // You can add custom validation here (allowed domains, banned emails, etc.)
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
    return event;
  } catch (err) {
    console.error("pre-signup error", err);
    throw err;
  }
};
