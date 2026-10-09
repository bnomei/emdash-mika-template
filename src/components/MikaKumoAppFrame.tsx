/**
 * Kumo sidebar application chrome for the template storefront: shop and account
 * navigation, responsive mobile top bar, and cart item count in labels.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Button, Link, Sidebar, Text, useSidebar } from "@cloudflare/kumo";
import {
  BagIcon,
  CompassIcon,
  HeartIcon,
  KeyIcon,
  ListIcon,
  PackageIcon,
  ReceiptIcon,
  ShoppingCartSimpleIcon,
  SparkleIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";

interface AppFrameProps {
  readonly title: string;
  readonly currentPath: string;
  readonly cartItemCount?: number;
  readonly children: ReactNode;
}

/** Root layout island wrapping page content in resizable Kumo sidebar navigation. */
export default function MikaKumoAppFrame({
  title,
  currentPath,
  cartItemCount = 0,
  children,
}: AppFrameProps) {
  const productsActive = currentPath === "/" || currentPath.startsWith("/products/");
  const [visibleCartItemCount, setCartItemCount] = useState(Math.max(0, cartItemCount));
  useEffect(() => {
    const sync = () => {
      const page = document.querySelector<HTMLElement>("[data-mika-storefront-view='page']");
      const count = Number(page?.dataset.mikaCartItemCount);
      if (Number.isFinite(count) && count >= 0) setCartItemCount(count);
    };
    sync();
    document.addEventListener("mika:storefront-refresh", sync);
    return () => document.removeEventListener("mika:storefront-refresh", sync);
  }, []);
  const cartLabel = visibleCartItemCount > 0 ? `Cart (${visibleCartItemCount})` : "Cart";
  const cartAriaLabel =
    visibleCartItemCount === 1
      ? "Cart, 1 item"
      : visibleCartItemCount > 1
        ? `Cart, ${visibleCartItemCount} items`
        : "Cart";

  return (
    <Sidebar.Provider
      className="mika-kumo-app-frame"
      defaultOpen
      defaultWidth={272}
      maxWidth={360}
      minWidth={220}
      mobileBreakpoint={900}
      peekable
      resizable
    >
      <Sidebar
        aria-label={`${title} navigation`}
        className="mika-kumo-sidebar"
        contentClassName="mika-kumo-sidebar-panel"
      >
        <Sidebar.Header>
          <a className="mika-kumo-brand" href="/">
            <span className="mika-kumo-brand-mark" aria-hidden="true">
              <SparkleIcon size={18} weight="fill" />
            </span>
            <span className="mika-kumo-brand-copy">
              <Text as="span" variant="heading3">
                Buttonwood Lot
              </Text>
              <Text as="span" variant="secondary" size="sm">
                Comic goods shop
              </Text>
            </span>
          </a>
        </Sidebar.Header>

        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Shop</Sidebar.GroupLabel>
            <Sidebar.Menu>
              <Sidebar.MenuButton
                active={productsActive}
                href="/"
                icon={PackageIcon}
                tooltip="Products"
              >
                Products
              </Sidebar.MenuButton>
              <Sidebar.MenuButton
                active={isActive(currentPath, "/cart")}
                href="/cart"
                icon={ShoppingCartSimpleIcon}
                tooltip="Cart"
              >
                <span data-mika-cart-badge="sidebar">{cartLabel}</span>
              </Sidebar.MenuButton>
              <Sidebar.MenuButton
                active={isActive(currentPath, "/wishlist")}
                href="/wishlist"
                icon={HeartIcon}
                tooltip="Wishlist"
              >
                Wishlist
              </Sidebar.MenuButton>
            </Sidebar.Menu>
          </Sidebar.Group>

          <Sidebar.Group>
            <Sidebar.GroupLabel>Account</Sidebar.GroupLabel>
            <Sidebar.Menu>
              <Sidebar.MenuButton
                active={currentPath === "/account"}
                href="/account"
                icon={UserCircleIcon}
                tooltip="Profile"
              >
                Profile
              </Sidebar.MenuButton>
              <Sidebar.MenuButton
                active={isActive(currentPath, "/account/orders")}
                href="/account/orders"
                icon={ReceiptIcon}
                tooltip="Orders"
              >
                Orders
              </Sidebar.MenuButton>
              <Sidebar.MenuButton
                active={isActive(currentPath, "/account/subscriptions")}
                href="/account/subscriptions"
                icon={CompassIcon}
                tooltip="Subscriptions"
              >
                Subscriptions
              </Sidebar.MenuButton>
              <Sidebar.MenuButton
                active={isActive(currentPath, "/account/licenses")}
                href="/account/licenses"
                icon={KeyIcon}
                tooltip="Licenses"
              >
                Licenses
              </Sidebar.MenuButton>
              <Sidebar.MenuButton
                active={isActive(currentPath, "/account/downloads")}
                href="/account/downloads"
                icon={BagIcon}
                tooltip="Downloads"
              >
                Downloads
              </Sidebar.MenuButton>
            </Sidebar.Menu>
          </Sidebar.Group>

        </Sidebar.Content>

        <Sidebar.Footer>
          <Sidebar.Trigger aria-label="Collapse navigation" />
        </Sidebar.Footer>
        <Sidebar.Rail aria-label="Toggle navigation rail" />
        <Sidebar.ResizeHandle aria-label="Resize navigation" />
      </Sidebar>

      <div className="mika-kumo-app-main">
        <div className="mika-kumo-mobile-topbar">
          <MobileSidebarTrigger />
          <a className="mika-kumo-mobile-brand" href="/">
            <SparkleIcon size={16} weight="fill" aria-hidden="true" />
            <span>Buttonwood Lot</span>
          </a>
          <nav aria-label="Quick links" className="mika-kumo-mobile-actions">
            <Link href="/cart" variant="plain" aria-label={cartAriaLabel}>
              <ShoppingCartSimpleIcon size={18} aria-hidden="true" />
              <span className="mika-kumo-mobile-count" data-mika-cart-badge="mobile">
                {visibleCartItemCount > 0 ? `(${visibleCartItemCount})` : ""}
              </span>
            </Link>
            <Link href="/account" variant="plain" aria-label="Account">
              <UserCircleIcon size={18} aria-hidden="true" />
            </Link>
          </nav>
        </div>

        {children}

        <footer className="mika-kumo-footer">
          <div className="mika-kumo-footer-copy">
            <Text as="p" variant="secondary" size="sm">
              Buttonwood Lot Press ships comic goods, digital downloads, subscriptions, and
              creator licenses.
            </Text>
          </div>
        </footer>
      </div>
    </Sidebar.Provider>
  );
}

function isActive(currentPath: string, href: string) {
  if (href === "/") return currentPath === "/";
  return currentPath === href || currentPath.startsWith(href + "/");
}

function MobileSidebarTrigger() {
  const { isMobile, open, openMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const expanded = isMobile ? openMobile : open;

  return (
    <Button
      aria-expanded={expanded}
      aria-label={expanded ? "Close navigation" : "Open navigation"}
      className="mika-kumo-mobile-trigger"
      icon={<ListIcon size={18} aria-hidden="true" />}
      onClick={() => {
        if (isMobile) {
          setOpenMobile(!openMobile);
        } else {
          toggleSidebar();
        }
      }}
      shape="square"
      type="button"
      variant="ghost"
    />
  );
}
