import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Minimal stub: in production this would create a file record and presign S3 upload
  const body = event.body ? JSON.parse(event.body) : {};
  const fakeId = `file_${Date.now()}`;

  return {
    statusCode: 201,
    body: JSON.stringify({ fileId: fakeId, input: body }),
  };
};
