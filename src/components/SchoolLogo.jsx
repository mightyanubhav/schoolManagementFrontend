import schoolLogo from "../assets/schoolLogo.png";

export default function SchoolLogo({ className = "h-12 w-12" }) {
  return (
    <img
      src={schoolLogo}
      alt="Baal Niketan School logo"
      className={`inline-block shrink-0 rounded-full bg-[#f7f1e7] object-contain ring-1 ring-[#102f52]/15 ${className}`}
      decoding="async"
    />
  );
}