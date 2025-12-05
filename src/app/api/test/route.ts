export const GET = async () => {
  return new Response("API is working");
}

export const POST = async (request: Request) => {
  const body = await request.json();
  return new Response(JSON.stringify({ received: body, message: "Data received successfully" }), { status: 200 });
}