import { useEffect, useRef, useState } from 'react';
import {
  DIRECTION_OPTIONS,
  getRoute,
  secondsToEta,
  useGoogleMap,
  useWatchLocation,
  getLocation,
} from '~/utils/mapUtils';

import {
  auth,
  deleteRoute,
  getRoutes,
  isRouteFinished,
  startRoute,
} from '../firebase';

import { Header } from '../components/Header';
import { useAuthState } from 'react-firebase-hooks/auth';
import { RouteCard } from '~/components/Route';

export default function BuddySystem() {
  const [user] = useAuthState(auth);

  const mapRef = useRef<HTMLDivElement>(null);
  const [goo, map] = useGoogleMap(mapRef);

  const [location, available, granted] = useWatchLocation();

  const [routes, setRoutes] = useState<any>([]);

  const [buddyLocation, setBuddyLocation] = useState([0, 0]);

  useEffect(() => {
    if (!location) return;
    setBuddyLocation([location.coords.latitude, location.coords.longitude]);
  }, [location]);

  const [marker, setMarker] = useState<google.maps.Marker>();

  useEffect(() => {
    if (!goo || !map || !location) return;
    if (!marker) {
      setMarker(
        new google.maps.Marker({
          position: {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          },
          icon: {
            url: "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3Csvg id='Layer_2' data-name='Layer 2' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cstyle%3E .cls-1 %7B fill: %23818CF8; %7D .cls-2 %7B fill: %23fff; %7D %3C/style%3E%3C/defs%3E%3Cg id='Layer_1-2' data-name='Layer 1'%3E%3Ccircle class='cls-2' cx='50' cy='50' r='50'/%3E%3Ccircle class='cls-1' cx='50' cy='50' r='40'/%3E%3C/g%3E%3C/svg%3E",
            scaledSize: new google.maps.Size(30, 30),
          },
          map: map,
        })
      );
    }

    if (marker) {
      marker.setPosition({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    }
  }, [location, goo, map, marker]);

  const [routeId, setRouteId] = useState('');
  const [directionsRenderer, setDirectionsRenderer] =
    useState<google.maps.DirectionsRenderer>();

  const [eta, setEta] = useState('');

  useEffect(() => {
    setInterval(() => {
      if (!routeId) {
        getRoutes().then((routes) => {
          setRoutes(routes);
        });
      } else {
        isRouteFinished(routeId).then((finished) => {
          if (finished) {
            directionsRenderer?.setMap(null);
            deleteRoute(routeId);
            setRouteId('');
          }
        });
      }
    }, 2000);
  }, [routeId, directionsRenderer]);

  useEffect(() => {
    if (!goo || !map) return;
    setDirectionsRenderer(new goo.maps.DirectionsRenderer());
  }, [goo, map]);

  const viewRoute = async (
    pickup: string | google.maps.LatLng,
    dropoff: string | google.maps.LatLng
  ) => {
    if (!goo || !map || !directionsRenderer || !(granted || location)) return;

    directionsRenderer.setMap(map);
    directionsRenderer.setOptions(DIRECTION_OPTIONS);

    const route = await getRoute(
      goo,
      new goo.maps.LatLng(buddyLocation[0], buddyLocation[1]),
      dropoff,
      [{ location: pickup }]
    );

    setEta(
      secondsToEta(
        route.routes[0].legs.reduce((acc, leg) => {
          return acc + (leg.distance?.value ?? 0);
        }, 0)
      )
    );
    directionsRenderer.setDirections(route);
  };

  return (
    <div className="min-h-screen relative ">
      <Header />
      <main className="relative md:grid md:grid-cols-2 lg:grid-cols-3 flex flex-col h-screen w-screen">
        <section className="relative md:pt-24 md:w-full md:h-full h-[50vh] bg-white p-5 shadow-lg space-y-5 col-span-1 overflow-y-auto">
          <div className="md:hidden w-full flex flex-row justify-center">
            <div className="w-12 h-1 bg-slate-200 rounded-full"></div>
          </div>
          {!(granted || location) ? (
            <h1 className="font-bold text-2xl text-slate-800">
              Please enable location services to continue
            </h1>
          ) : null}
          {!user && (granted || location) ? (
            <h1 className="font-bold text-2xl text-slate-800">
              Please login to continue
            </h1>
          ) : null}
          {!routeId && (granted || location) && user ? (
            <>
              <h1 className="font-bold text-2xl text-slate-800">
                Howdy, Buddy
              </h1>
              <div className="space-y-2 flex flex-col justify-between">
                {routes && routes.length > 0 ? (
                  <ul>
                    {routes.map((route: any) => {
                      return (
                        <RouteCard
                          key={route.id}
                          route={route}
                          onViewRoute={() => {
                            viewRoute(route.start, route.destination);
                          }}
                          onStartRoute={() => {
                            viewRoute(route.start, route.destination);
                            startRoute(route.id, user?.uid!);
                            setRouteId(route.id);
                          }}
                          onDeleteRoute={() => {
                            deleteRoute(route.id);
                          }}
                        />
                      );
                    })}
                  </ul>
                ) : (
                  <p>No routes</p>
                )}
              </div>
            </>
          ) : null}
          {routeId ? (
            <>
              <h1 className="text-4xl font-semibold mb-10">
                Your Runner:{' '}
                {
                  routes.filter((route: any) => {
                    return route.id === routeId;
                  })[0].displayName
                }
              </h1>
              <img
                className="rounded-full"
                src={
                  routes.filter((route: any) => {
                    return route.id === routeId;
                  })[0].userPhoto
                }
                alt={
                  routes.filter((route: any) => {
                    return route.id === routeId;
                  })[0].displayName
                }
                width="150"
                height="150"
              />
              <div className="space-y-2 flex flex-col justify-between h-[90%]">
                <div className="h-full">
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Your Trip</h2>
                    <div className="grid grid-cols-6 w-full relative before:absolute before:top-5 before:h-7 before:w-1.5 before:left-[9px]  before:bg-red-500 before:bg-gradient-to-b before:from-[#F9B8BB] before:to-[#818CF8]">
                      <svg
                        viewBox="0 0 50 50"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                      >
                        <circle cx="25" cy="25" r="25" fill="#F9B8BB" />
                        <circle cx="25.5" cy="24.5" r="12.5" fill="white" />
                      </svg>
                      <p className="col-span-4 overflow-hidden text-ellipsis whitespace-nowrap block text-start">
                        You
                      </p>
                      <p className="col-span-1 text-xs text-right font-semibold">
                        Start
                      </p>
                    </div>
                    <div className="grid grid-cols-6 flex-row w-full relative before:absolute before:top-5 before:h-7 before:w-1.5 before:left-[9px]  before:bg-red-500 before:bg-gradient-to-b before:from-[#818CF8] before:to-[#F9B8BB]">
                      <svg
                        viewBox="0 0 50 50"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                      >
                        <circle cx="25" cy="25" r="25" fill="#818CF8" />
                        <circle cx="25.5" cy="24.5" r="12.5" fill="white" />
                      </svg>
                      <p className="col-span-4 text-base overflow-hidden text-ellipsis whitespace-nowrap block text-start">
                        {
                          routes.filter((route: any) => {
                            return route.id === routeId;
                          })[0].start
                        }
                      </p>
                      <p className="col-span-1 text-xs text-right font-semibold">
                        Pick up
                      </p>
                    </div>
                    <div className="grid grid-cols-6 w-full">
                      <svg
                        viewBox="0 0 50 50"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                      >
                        <circle cx="25" cy="25" r="25" fill="#F9B8BB" />
                        <circle cx="25.5" cy="24.5" r="12.5" fill="white" />
                      </svg>
                      <p className="col-span-4 overflow-hidden text-ellipsis whitespace-nowrap block text-start">
                        {
                          routes.filter((route: any) => {
                            return route.id === routeId;
                          })[0].destination
                        }
                      </p>
                      <p className="col-span-1 text-xs text-right font-semibold">
                        Drop-off
                      </p>
                    </div>
                    <p>
                      <span className="text-lg font-medium">ETA:</span>{' '}
                      {eta ? eta : 'Calculating...'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>
        <div
          className="-order-1 md:order-1 md:h-full h-[50vh] md:w-full md:col-span:1 lg:col-span-2"
          id="map"
          ref={mapRef}
        ></div>
      </main>
    </div>
  );
}
