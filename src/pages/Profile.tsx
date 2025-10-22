import ProfileStrip from "../components/ProfileStrip";

export default function Profile() {
  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-semibold mb-4">Профил</h1>
      <ProfileStrip />
    </div>
  );
}
