import RoomScene from '@/components/room/RoomScene';

export default function Home() {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#f4ddc0] bg-[radial-gradient(circle_at_42%_38%,rgba(255,245,209,0.75),rgba(216,179,139,0.25)_45%,rgba(133,96,72,0.34))]"
      aria-label="Portfolio room canvas">
      <RoomScene />
    </main>
  );
}
