// Face descriptors remain in the browser; reference photos are loaded from the staff-only student records.
type FaceApi = typeof import("face-api.js");
let apiPromise: Promise<FaceApi> | undefined;
const references = new Map<string, { image: string; descriptor: Float32Array | null }>();

async function faceApi() {
  apiPromise ??= import("face-api.js").then(async (api) => {
    await Promise.all([
      api.nets.tinyFaceDetector.loadFromUri("/models"),
      api.nets.faceLandmark68Net.loadFromUri("/models"),
      api.nets.faceRecognitionNet.loadFromUri("/models"),
    ]);
    return api;
  }).catch((error) => { apiPromise = undefined; throw error; });
  return apiPromise;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

async function describe(src: string): Promise<{ descriptor: Float32Array; faces: number } | null> {
  const api = await faceApi();
  const image = await loadImage(src);
  const faces = await api.detectAllFaces(image, new api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks().withFaceDescriptors();
  const first = faces[0];
  if (!first) return null;
  return { descriptor: first.descriptor, faces: faces.length };
}

export async function validateFacePhoto(image: string): Promise<"ok" | "none" | "multiple"> {
  const result = await describe(image);
  return !result ? "none" : result.faces > 1 ? "multiple" : "ok";
}

export type FaceStudent = { student_id: string; name: string; class: string; section: string; face_image: string | null };

export async function matchFace(image: string, students: FaceStudent[]) {
  const live = await describe(image);
  if (!live) return { status: "no_face" as const };
  if (live.faces !== 1) return { status: "multiple" as const };
  const registered = students.filter((student) => student.face_image);
  if (!registered.length) return { status: "no_registered" as const };

  const currentIds = new Set(registered.map((s) => s.student_id));
  for (const id of references.keys()) if (!currentIds.has(id)) references.delete(id);
  const api = await faceApi();
  const matches: { student: FaceStudent; distance: number }[] = [];
  for (const student of registered) {
    const imageSrc = student.face_image;
    if (!imageSrc) continue;
    let cached = references.get(student.student_id);
    if (!cached || cached.image !== imageSrc) {
      const face = await describe(imageSrc).catch(() => null);
      cached = { image: imageSrc, descriptor: face?.faces === 1 ? face.descriptor : null };
      references.set(student.student_id, cached);
    }
    if (cached.descriptor) matches.push({ student, distance: api.euclideanDistance(live.descriptor, cached.descriptor) });
  }
  matches.sort((a, b) => a.distance - b.distance);
  const best = matches[0];
  // A conservative absolute limit plus separation from the runner-up prevents ambiguous matches.
  if (!best || best.distance > 0.48 || (matches[1] && matches[1].distance - best.distance < 0.08))
    return { status: "unknown" as const };
  const { face_image: _image, ...student } = best.student;
  return { status: "match" as const, student };
}