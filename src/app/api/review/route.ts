import { NextRequest } from 'next/server';
import { setTaskReview, updateArtifactReview } from '@/lib/queries';

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { type, id, review_status, note } = body;
  if (!type || !id || !review_status) {
    return Response.json({ error: 'Missing type, id, or review_status' }, { status: 400 });
  }

  if (type === 'task') {
    setTaskReview(id, review_status, note);
  } else if (type === 'artifact') {
    updateArtifactReview(Number(id), review_status);
  } else {
    return Response.json({ error: `Unsupported type: ${type}` }, { status: 400 });
  }

  return Response.json({ ok: true });
}
