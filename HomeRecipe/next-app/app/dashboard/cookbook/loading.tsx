import { LoadingScreen } from "@/components/LoadingScreen";

export default function Loading() {
  return (
    <div className="right-side-panel">
      <LoadingScreen fullScreen={false} />
    </div>
  );
}
