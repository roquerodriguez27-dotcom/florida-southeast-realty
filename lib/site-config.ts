export const SITE = {
  name: "Florida Southeast Realty, Inc.",
  shortName: "Florida Southeast Realty",
  url: "https://www.floridasoutheastrealty.com",
  brokerName: "Roque Rodriguez",
  phoneDisplay: "(973) 985-6011",
  phoneHref: "tel:+19739856011",
  email: "roque@floridasoutheastrealty.com",
  address: {
    street: "1375 Gateway Blvd",
    city: "Boynton Beach",
    region: "FL",
    postalCode: "33426",
    country: "US",
  },
  serviceAreas: [
    "Fort Lauderdale",
    "Boca Raton",
    "Delray Beach",
    "Boynton Beach",
    "Lake Worth Beach",
    "West Palm Beach",
    "Wellington",
    "Palm Beach Gardens",
    "Jupiter",
    "Wilton Manors",
    "Hillsboro Beach",
    "Lauderdale-by-the-Sea",
  ],
} as const;

export const SITE_ADDRESS_LINE = `${SITE.address.street}, ${SITE.address.city}, ${SITE.address.region} ${SITE.address.postalCode}`;
