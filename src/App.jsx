import { Routes, Route } from "react-router-dom";
import PoolVideoBackground from "./components/PoolVideoBackground.jsx";
import appStyles from "./App.module.css";
import LandingPage from "./pages/LandingPage.jsx";
import TechniciansPage from "./pages/TechniciansPage.jsx";
import TechnicianRouteTypeChooser from "./pages/technician/TechnicianRouteTypeChooser.jsx";
import TechnicianRoutePropertiesPage from "./pages/technician/TechnicianRoutePropertiesPage.jsx";
import StephenPropertyDetailPage from "./pages/stephen/StephenPropertyDetailPage.jsx";
import AdministratorPage from "./pages/AdministratorPage.jsx";
import AdminActivityPage from "./pages/admin/AdminActivityPage.jsx";
import AdminActivityDetailPage from "./pages/admin/AdminActivityDetailPage.jsx";
import AdminActivityPropertyPage from "./pages/admin/AdminActivityPropertyPage.jsx";
import AdminServiceHistoryPage from "./pages/admin/AdminServiceHistoryPage.jsx";
import PropertyIncidentReportPage from "./pages/admin/PropertyIncidentReportPage.jsx";
import RouteSheetDashboardPage from "./pages/admin/RouteSheetDashboardPage.jsx";

export default function App() {
  return (
    <>
      <PoolVideoBackground />
      <div className={appStyles.appFrame}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/technicians" element={<TechniciansPage />} />
          <Route
            path="/technician/:slug/turnover/:propertySlug"
            element={<StephenPropertyDetailPage />}
          />
          <Route
            path="/technician/:slug/midweek/:propertySlug"
            element={<StephenPropertyDetailPage />}
          />
          <Route
            path="/technician/:slug/turnover"
            element={<TechnicianRoutePropertiesPage routeType="turnover" />}
          />
          <Route
            path="/technician/:slug/midweek"
            element={<TechnicianRoutePropertiesPage routeType="midweek" />}
          />
          <Route path="/technician/:slug/:propertySlug" element={<StephenPropertyDetailPage />} />
          <Route path="/technician/:slug" element={<TechnicianRouteTypeChooser />} />

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
            path="/administrator/route-sheet-dashboard"
            element={<RouteSheetDashboardPage />}
          />
          <Route
            path="/administrator/incident-report"
            element={<PropertyIncidentReportPage />}
          />

          <Route path="/administrator" element={<AdministratorPage />} />
        </Routes>
      </div>
    </>
  );
}
