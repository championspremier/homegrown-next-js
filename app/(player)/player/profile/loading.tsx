import PageSkeleton from "@/app/components/PageSkeleton";

export default function Loading() {
  return (
    <>
      <style>{`
        [class*="layout_topbar__"] {
          display: none !important;
        }
      `}</style>
      <PageSkeleton variant="default" />
    </>
  );
}
