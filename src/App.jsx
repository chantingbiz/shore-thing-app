import { Routes, Route } from "react-router-dom";
import PoolVideoBackground from "./components/PoolVideoBackground.jsx";
import appStyles from "./App.module.css";
import LandingPage from "./pages/LandingPage.jsx";
import TechniciansPage from "./pages/TechniciansPage.jsx";
import TechnicianDetailPage from "./pages/TechnicianDetailPage.jsx";
import StephenPropertiesPage from "./pages/stephen/StephenPropertiesPage.jsx";
import StephenPropertyDetailPage from "./pages/stephen/StephenPropertyDetailPage.jsx";
import AdministratorPage from "./pages/AdministratorPage.jsx";
import AdminActivityPage from "./pages/admin/AdminActivityPage.jsx";
import AdminActivityDetailPage from "./pages/admin/AdminActivityDetailPage.jsx";
import AdminActivityPropertyPage from "./pages/admin/AdminActivityPropertyPage.jsx";
import AdminRoutesPage from "./pages/admin/AdminRoutesPage.jsx";
import AdminStephenRoutesPage from "./pages/admin/AdminStephenRoutesPage.jsx";
import AdminRoutesPlaceholderPage from "./pages/admin/AdminRoutesPlaceholderPage.jsx";
import AdminServiceHistoryPage from "./pages/admin/AdminServiceHistoryPage.jsx";

export default function App() {
  return (
    <>
      <PoolVideoBackground />
      <div className={appStyles.appFrame}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/technicians" element={<TechniciansPage />} />
          <Route path="/technician/stephen" element={<StephenPropertiesPage />} />
          <Route path="/technician/:slug/:propertySlug" element={<StephenPropertyDetailPage />} />
          <Route path="/technician/:slug" element={<TechnicianDetailPage />} />

          <Route
            path="/administrator/activity/:techSlug/:propertySlug"
            element={<AdminActivityPropertyPage />}
          />
          <Route
            path="/administrator/activity/:techSlug"
            element={<AdminActivityDetailPage />}
          />
          <Route path="/administrator/activity" element={<AdminActivityPage />} />
          <Route
            path="/administrator/service-history"
            element={<AdminServiceHistoryPage />}
          />

          <Route
            path="/administrator/routes/stephen"
            element={<AdminStephenRoutesPage />}
          />
          <Route
            path="/administrator/routes/:techSlug"
            element={<AdminRoutesPlaceholderPage />}
          />
          <Route path="/administrator/routes" element={<AdminRoutesPage />} />

          <Route path="/administrator" element={<AdministratorPage />} />
        </Routes>
      </div>
    </>
  );
}
