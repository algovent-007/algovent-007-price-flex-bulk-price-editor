import {
  getProductNumericId,
  getShopifyAdminProductUrl,
  openShopifyAdminProduct,
} from "../utils/shopify-admin-links";

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
    <s-link href={url} onClick={handleClick}>
      {children}
    </s-link>
  );
}
