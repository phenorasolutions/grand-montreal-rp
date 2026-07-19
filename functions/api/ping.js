export async function onRequestGet() {
  return Response.json({
    success: true,
    message: "Grand Montréal RP CMS API Online",
    version: "0.1.0"
  });
}