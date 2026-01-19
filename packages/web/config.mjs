const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://claudius.to" : `https://${stage}.claudius.to`,
  console: stage === "production" ? "https://claudius.to/auth" : `https://${stage}.claudius.to/auth`,
  email: "", // TODO: Add contact email
  github: "https://github.com/crisogray/claudius",
  headerLinks: [
    { name: "Home", url: "/" },
    { name: "Docs", url: "/docs/" },
  ],
}
