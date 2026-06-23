exports.handler = async () => {
  const pixelId = process.env.META_PIXEL_ID || null;
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300"
    },
    body: JSON.stringify({ pixelId })
  };
};
