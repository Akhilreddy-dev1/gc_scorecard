import { useEffect, useState } from "react";
const photos = ["/group-photos/group-1.jpg", "/group-photos/group-2.jpg", "/group-photos/group-3.jpg"];
export function GroupPhotoBackdrop({ blurred = false }: { blurred?: boolean }) {
  const [active, setActive] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setActive((n) => (n + 1) % photos.length), 6000); return () => clearInterval(timer); }, []);
  return <div className={`photo-backdrop${blurred ? " blurred" : ""}`} aria-hidden="true">
    {photos.map((src, i) => <div key={src} className={`photo-layer${active === i ? " active" : ""}`} style={{ backgroundImage: `url("${src}")` }} />)}
    <div className="photo-fallback" /><div className="photo-vignette" />
  </div>;
}
