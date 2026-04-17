import { NextRequest } from 'next/server';
import { updateArtifactReview, getReviewQueue } from '@/lib/queries';

export async function GET() {
  const queue = getReviewQueue();
  return Response.json(queue);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, review_status } = body;
  if (!id || !review_status) {
    return Response.json({ error: 'Missing id or review_status' }, { status: 400 });
  }
  updateArtifactReview(id, review_status);
  return Response.json({ ok: true });
}
