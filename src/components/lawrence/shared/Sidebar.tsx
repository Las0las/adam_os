import { lawrenceNav } from "@/config/navigation/lawrence-nav";

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        LAWRENCE
        <small>Enterprise Operating System</small>
      </div>
      {lawrenceNav.map((section) => (
        <div className="nav-group" key={section.title}>
          <h4>{section.title}</h4>
          {section.items.map((item) => (
            <a className="nav-link" href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </div>
      ))}
    </aside>
  );
}
