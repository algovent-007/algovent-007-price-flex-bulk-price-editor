import {
  getProductNumericId,
  getShopifyAdminProductUrl,
  openShopifyAdminProduct,
} from "../utils/shopify-admin-links";

const linkStyle = {
  color: "var(--p-color-text-link, #005bd3)",
  textDecoration: "underline",
  cursor: "pointer",
};

export default function ProductLogLink({ productId, shopDomain, children, onNavigate }) {
  const url = getShopifyAdminProductUrl(productId, shopDomain);

  if (!url || !getProductNumericId(productId)) {
    return children;
  }

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onNavigate?.();
    openShopifyAdminProduct(productId, shopDomain);
  };

  return (
    <a href={url} target="_top" rel="noopener noreferrer" style={linkStyle} onClick={handleClick}>
      {children}
    </a>
  );
}
