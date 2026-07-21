const association = {
  associatedApplications: [
    {
      applicationId: "4e101a78-1afe-474c-b27c-c1d78fdd40d6",
    },
  ],
};

export function GET() {
  return Response.json(association, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
