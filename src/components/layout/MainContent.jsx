export default function MainContent({ children, className = '' }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`flex-1 py-4 sm:py-5 focus:outline-none ${className}`}
    >
      <div className="supplify-dashboard-container">{children}</div>
    </main>
  );
}
