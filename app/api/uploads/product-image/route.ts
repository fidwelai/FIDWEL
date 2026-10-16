import { supabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const admin = supabaseAdmin;

  if (!admin) {
    return Response.json(
      { error: "Image uploads are not available right now." },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }

  const { data: userData, error: userError } = await admin.auth.getUser(token);

  if (userError || !userData.user) {
    return Response.json(
      { error: "Your session has expired. Please sign in again." },
      { status: 401 }
    );
  }

  const { data: vendor, error: vendorError } = await admin
    .from("vendor_profiles")
    .select("id, status, verified")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (vendorError) {
    return Response.json(
      { error: "Could not verify your vendor account." },
      { status: 500 }
    );
  }

  if (!vendor || vendor.status !== "active" || vendor.verified !== true) {
    return Response.json(
      { error: "Only approved, active vendors can upload product images." },
      { status: 403 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }

  const entry = form.get("file");

  if (entry === null || typeof entry === "string") {
    return Response.json({ error: "No image was provided." }, { status: 400 });
  }

  const file = entry;
  const extension = ALLOWED_TYPES[file.type];

  if (!extension) {
    return Response.json(
      { error: "Only JPG, PNG or WebP images are allowed." },
      { status: 415 }
    );
  }

  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "Image must be smaller than 5 MB." },
      { status: 413 }
    );
  }

  const path = `${vendor.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return Response.json(
      { error: "Could not upload the image. Please try again." },
      { status: 500 }
    );
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);

  return Response.json({ url: data.publicUrl, path }, { status: 201 });
}
