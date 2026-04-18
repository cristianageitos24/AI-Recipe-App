import "@/app/styling/AboutPage.css";

export default function AboutPage() {
  return (
    <div className="dashboard-about">
      <h1 className="dashboard-about-title">About</h1>
      <section className="dashboard-about-section" aria-labelledby="about-nutrition-heading">
        <h2 id="about-nutrition-heading" className="dashboard-about-h2">
          Nutrition data
        </h2>
        <p className="dashboard-about-p">
          Where the app shows ingredient or recipe nutrition, it is derived from{" "}
          <a
            className="dashboard-about-link"
            href="https://fdc.nal.usda.gov/"
            target="_blank"
            rel="noopener noreferrer"
          >
            USDA FoodData Central
          </a>
          , a public-domain U.S. Government dataset (CC0).
        </p>
      </section>
    </div>
  );
}
