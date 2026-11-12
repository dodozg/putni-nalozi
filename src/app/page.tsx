import PutniNaloziApp from "@/components/PutniNaloziApp";
import {
  INITIAL_DEMO_EMPLOYEES,
  INITIAL_DEMO_LOCO_TRIPS,
  INITIAL_DEMO_ORDERS,
  INITIAL_DEMO_SETTINGS,
  INITIAL_DEMO_VEHICLES,
} from "@/lib/demo-seed";

export default function Home() {
  return (
    <PutniNaloziApp
      initialSettings={INITIAL_DEMO_SETTINGS}
      initialEmployees={INITIAL_DEMO_EMPLOYEES}
      initialVehicles={INITIAL_DEMO_VEHICLES}
      initialOrders={INITIAL_DEMO_ORDERS}
      initialLocoTrips={INITIAL_DEMO_LOCO_TRIPS}
    />
  );
}
