export const GET = async () => {
  return new Response("API is working");
}

export const POST = async (request: Request) => {
  const body = await request.json();
  if (process.env.NODE_ENV !== "production") {
    console.log("Received data:", body);
  }
  return new Response(JSON.stringify({ received: body, message: "Data received successfully" }), { status: 200 });
}