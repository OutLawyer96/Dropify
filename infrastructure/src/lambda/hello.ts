export const handler = async (): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: 'Success! The API is live and connected.' })
  };
};
